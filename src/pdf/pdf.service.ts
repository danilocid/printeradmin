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
      const width = printerId === 'bixolon'
        ? parseInt(process.env.BIXOLON_WIDTH || '576')
        : parseInt(process.env.XPRINTER_WIDTH || '400');

      const pbmPath = await this.pdfRendererService.renderPdfToImage(pdfPath, '', width);
      this.logger.log(`PDF rendered to PBM: ${pbmPath}`);

      const pbmData = await fs.promises.readFile(pbmPath);
      const { width: imgWidth, height: imgHeight, pixels } = this.parsePbm(pbmData);
      this.logger.log(`PBM parsed: ${imgWidth}x${imgHeight}`);

      const escposData = this.imageToEscPos(pixels, imgWidth, imgHeight);
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

  private imageToEscPos(pixels: Buffer, imgWidth: number, imgHeight: number): Buffer {
    const ESC = 0x1b;
    const GS = 0x1d;
    const v = 0x76;
    const m = 0x00;
    const fn = 0x00;

    const init = Buffer.from([ESC, 0x40]);
    const rasterCmd = Buffer.from([GS, v, m, fn]);

    const widthBytes = Math.ceil(imgWidth / 8);
    const widthBytesBuf = Buffer.from([widthBytes & 0xff, (widthBytes >> 8) & 0xff]);
    const heightBuf = Buffer.from([imgHeight & 0xff, (imgHeight >> 8) & 0xff]);

    const center = Buffer.from([ESC, 0x61, 0x01]);
    const feed = Buffer.from([ESC, 0x64, 3]);
    const cut = Buffer.from([GS, 0x56, 0x00]);

    return Buffer.concat([init, center, rasterCmd, widthBytesBuf, heightBuf, pixels, feed, cut]);
  }
}
