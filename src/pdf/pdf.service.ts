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
    this.logger.log(`[PDF] Starting processing for printer="${printerId}" file="${file.originalname}" size=${file.size} bytes`);

    const tempDir = path.join(os.tmpdir(), `print-server-${Date.now()}`);
    await fs.promises.mkdir(tempDir, { recursive: true });

    const pdfPath = path.join(tempDir, file.originalname);
    await fs.promises.writeFile(pdfPath, file.buffer);

    try {
      const targetWidth = printerId === 'bixolon'
        ? parseInt(process.env.BIXOLON_WIDTH || '576')
        : parseInt(process.env.XPRINTER_WIDTH || '400');

      this.logger.log(`[PDF] Target printer width: ${targetWidth}px`);

      this.logger.log(`[PDF] Step 1/5: Rendering PDF to PBM with pdftoppm at 203 DPI...`);
      const pbmPath = await this.pdfRendererService.renderPdfToImage(pdfPath, '', targetWidth);
      const pbmStat = await fs.promises.stat(pbmPath);
      this.logger.log(`[PDF] Step 1 OK: PBM file created at "${pbmPath}" (${pbmStat.size} bytes on disk)`);

      this.logger.log(`[PDF] Step 2/5: Reading and parsing PBM header...`);
      const pbmData = await fs.promises.readFile(pbmPath);
      this.logger.log(`[PDF] Step 2 OK: PBM file read into memory (${pbmData.length} bytes), header bytes: ${pbmData.slice(0, 16).toString('hex')}`);
      const { width: imgWidth, height: imgHeight, pixels } = this.parsePbm(pbmData);
      this.logger.log(`[PDF] Step 2 OK: PBM dimensions=${imgWidth}x${imgHeight} pixel_data_size=${pixels.length} bytes (expected=${Math.ceil(imgWidth/8)*imgHeight})`);

      this.logger.log(`[PDF] Step 3/5: Scaling image from ${imgWidth}x${imgHeight} to ${targetWidth}x? ...`);
      const scaledHeight = Math.floor(imgHeight * (targetWidth / imgWidth));
      const scaledPixels = this.scalePbm(pixels, imgWidth, imgHeight, targetWidth);
      const scaledWidthBytes = Math.ceil(targetWidth / 8);
      this.logger.log(`[PDF] Step 3 OK: Scaled to ${targetWidth}x${scaledHeight} (pixel_data=${scaledPixels.length} bytes, expected=${scaledWidthBytes * scaledHeight})`);

      this.logger.log(`[PDF] Step 4/5: Building ESC/POS raster command...`);
      const escposData = this.imageToEscPos(scaledPixels, targetWidth, scaledHeight);
      this.logger.log(`[PDF] Step 4 OK: ESC/POS buffer built (${escposData.length} bytes total)`);
      this.logger.log(`[PDF] ESC/POS header (first 32 bytes): ${escposData.slice(0, 32).toString('hex')}`);
      this.logger.log(`[PDF] ESC/POS structure: INIT=${escposData.slice(0,2).toString('hex')} CENTER=${escposData.slice(2,5).toString('hex')} RASTER_CMD=${escposData.slice(5,9).toString('hex')} WIDTH=${escposData.slice(9,11).toString('hex')} HEIGHT=${escposData.slice(11,13).toString('hex')} PIXELS=${scaledPixels.length}bytes FEED_CUT=${escposData.slice(13 + scaledPixels.length).toString('hex')}`);
      this.logger.log(`[PDF] Raster command details: GS_v_0=${escposData[5].toString(16)}_${escposData[6].toString(16)}_${escposData[7].toString(16)}_${escposData[8].toString(16)} width_bytes=${escposData[9] | (escposData[10] << 8)} height=${escposData[11] | (escposData[12] << 8)}`);

      this.logger.log(`[PDF] Step 5/5: Sending ${escposData.length} bytes to printer "${printerId}" via USB...`);
      await this.printersService.printRaw(printerId, escposData);
      this.logger.log(`[PDF] Step 5 OK: All bytes written to USB device successfully`);

      await this.pdfRendererService.cleanup(pbmPath);
    } catch (error) {
      this.logger.error(`[PDF] FAILED: ${error.message}`, error.stack);
      throw error;
    } finally {
      await this.pdfRendererService.cleanup(pdfPath);
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }

    this.logger.log(`[PDF] Processing complete for "${file.originalname}"`);
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
        if (bit === 0) {
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
