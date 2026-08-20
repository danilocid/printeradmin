import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PdfRendererService } from './pdf-renderer.service';
import { PrintersService } from '../printers/printers.service';

interface MultipartFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(
    private readonly pdfRendererService: PdfRendererService,
    private readonly printersService: PrintersService,
  ) {}

  async processPdf(printerId: string, file: MultipartFile) {
    const tempDir = path.join(os.tmpdir(), `print-server-${Date.now()}`);
    await fs.promises.mkdir(tempDir, { recursive: true });

    const pdfPath = path.join(tempDir, file.originalname);
    await fs.promises.writeFile(pdfPath, file.buffer);

    try {
      const targetWidth = printerId === 'bixolon'
        ? parseInt(process.env.BIXOLON_WIDTH || '576')
        : parseInt(process.env.XPRINTER_WIDTH || '400');

      const pbmPath = await this.pdfRendererService.renderPdfToImage(pdfPath, '', targetWidth);
      this.logger.log(`PDF rendered to PBM: ${pbmPath}`);

      const pbmData = await fs.promises.readFile(pbmPath);
      const { width: imgWidth, height: imgHeight, pixels } = this.parsePbm(pbmData);
      this.logger.log(`PBM parsed: ${imgWidth}x${imgHeight}`);

      const scaledPixels = this.scalePbm(pixels, imgWidth, imgHeight, targetWidth);
      const scaledHeight = Math.floor(imgHeight * (targetWidth / imgWidth));
      this.logger.log(`Scaled to: ${targetWidth}x${scaledHeight}`);

      const escposData = this.imageToEscPos(scaledPixels, targetWidth, scaledHeight);
      this.logger.log(`Image converted to ESC/POS: ${escposData.length} bytes`);

      await this.printersService.printRaw(printerId, escposData);
      this.logger.log(`PDF sent to printer: ${printerId}`);

      await this.pdfRendererService.cleanup(pbmPath);
    } catch (error) {
      this.logger.error(`Failed to process PDF: ${error.message}`);
      throw error;
    } finally {
      await this.pdfRendererService.cleanup(pdfPath);
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }

    return { success: true };
  }

  private parsePbm(data: Buffer): { width: number; height: number; pixels: Buffer } {
    let offset = 0;

    while (offset < data.length) {
      if (data[offset] === 0x23) {
        while (offset < data.length && data[offset] !== 0x0a) {
          offset++;
        }
        offset++;
      } else {
        break;
      }
    }

    if (data[offset] === 0x50 && data[offset + 1] === 0x34) {
      offset += 2;
    }

    while (offset < data.length && (data[offset] === 0x20 || data[offset] === 0x0a || data[offset] === 0x0d)) {
      offset++;
    }

    let widthStr = '';
    while (offset < data.length && data[offset] >= 0x30 && data[offset] <= 0x39) {
      widthStr += String.fromCharCode(data[offset]);
      offset++;
    }

    while (offset < data.length && (data[offset] === 0x20 || data[offset] === 0x0a || data[offset] === 0x0d)) {
      offset++;
    }

    let heightStr = '';
    while (offset < data.length && data[offset] >= 0x30 && data[offset] <= 0x39) {
      heightStr += String.fromCharCode(data[offset]);
      offset++;
    }

    while (offset < data.length && (data[offset] === 0x20 || data[offset] === 0x0a || data[offset] === 0x0d)) {
      offset++;
    }

    const width = parseInt(widthStr, 10);
    const height = parseInt(heightStr, 10);
    const pixels = data.slice(offset);

    return { width, height, pixels };
  }

  private scalePbm(pixels: Buffer, srcWidth: number, srcHeight: number, targetWidth: number): Buffer {
    const targetHeight = Math.floor(srcHeight * (targetWidth / srcWidth));
    const targetWidthBytes = Math.ceil(targetWidth / 8);
    const scaled = Buffer.alloc(targetHeight * targetWidthBytes);

    for (let y = 0; y < targetHeight; y++) {
      const srcY = Math.floor(y * srcHeight / targetHeight);
      for (let x = 0; x < targetWidth; x++) {
        const srcX = Math.floor(x * srcWidth / targetWidth);
        const srcByteIndex = srcY * Math.ceil(srcWidth / 8) + Math.floor(srcX / 8);
        const srcBitIndex = 7 - (srcX % 8);
        const bit = (pixels[srcByteIndex] >> srcBitIndex) & 1;

        const targetByteIndex = y * targetWidthBytes + Math.floor(x / 8);
        const targetBitIndex = 7 - (x % 8);
        if (bit) {
          scaled[targetByteIndex] |= (1 << targetBitIndex);
        }
      }
    }

    return scaled;
  }

  private imageToEscPos(pixels: Buffer, imgWidth: number, imgHeight: number): Buffer {
    const ESC = 0x1b;
    const GS = 0x1d;

    const init = Buffer.from([ESC, 0x40]);
    const rasterCmd = Buffer.from([GS, 0x76, 0x30, 0x00]);

    const widthBytes = Math.ceil(imgWidth / 8);
    const widthBytesBuf = Buffer.from([widthBytes & 0xff, (widthBytes >> 8) & 0xff]);
    const heightBuf = Buffer.from([imgHeight & 0xff, (imgHeight >> 8) & 0xff]);

    const center = Buffer.from([ESC, 0x61, 0x01]);
    const feed = Buffer.from([ESC, 0x64, 3]);
    const cut = Buffer.from([GS, 0x56, 0x00]);

    return Buffer.concat([init, center, rasterCmd, widthBytesBuf, heightBuf, pixels, feed, cut]);
  }
}
