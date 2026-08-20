import { Controller, Get, Post, Param, Body, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { PrintersService } from './printers.service';
import { PrintRawDto } from './dto/print-raw.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';

@ApiTags('printers')
@Controller('printers')
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  @Get()
  @ApiOperation({ summary: 'List all printers' })
  @ApiResponse({ status: 200, description: 'List of printers' })
  listPrinters() {
    return {
      printers: this.printersService.listPrinters(),
    };
  }

  @Get(':printerId/status')
  @ApiOperation({ summary: 'Get printer status' })
  @ApiParam({ name: 'printerId', description: 'Printer ID' })
  @ApiResponse({ status: 200, description: 'Printer status' })
  @ApiResponse({ status: 404, description: 'Printer not found' })
  async getStatus(@Param('printerId') printerId: string) {
    const status = await this.printersService.getStatus(printerId);
    return {
      printer: printerId,
      status: status.status,
    };
  }

  @Post(':printerId/raw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Print raw data' })
  @ApiParam({ name: 'printerId', description: 'Printer ID' })
  @ApiBody({ type: PrintRawDto })
  @ApiResponse({ status: 200, description: 'Raw data sent to printer' })
  @ApiResponse({ status: 404, description: 'Printer not found' })
  async printRaw(
    @Param('printerId') printerId: string,
    @Body() printRawDto: PrintRawDto,
  ) {
    const data = Buffer.from(printRawDto.data, 'hex');
    await this.printersService.printRaw(printerId, data);
    return { success: true };
  }

  @Post(':printerId/test-image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Print test image pattern to verify image commands work' })
  @ApiParam({ name: 'printerId', description: 'Printer ID' })
  @ApiQuery({ name: 'mode', required: false, enum: ['gs-v0', 'esc-star-0', 'esc-star-1', 'esc-star-33'], description: 'ESC/POS image command mode' })
  @ApiQuery({ name: 'pattern', required: false, enum: ['checker', 'black', 'white', 'hlines', 'vlines'], description: 'Test pattern to print' })
  @ApiResponse({ status: 200, description: 'Test image sent to printer' })
  async printTestImage(
    @Param('printerId') printerId: string,
    @Query('mode') mode: 'gs-v0' | 'esc-star-0' | 'esc-star-1' | 'esc-star-33' = 'gs-v0',
    @Query('pattern') pattern: 'checker' | 'black' | 'white' | 'hlines' | 'vlines' = 'checker',
  ) {
    const data = this.generateTestImage(mode, pattern);
    await this.printersService.printRaw(printerId, data);
    return { success: true, bytes: data.length, mode, pattern };
  }

  private generateTestImage(
    mode: 'gs-v0' | 'esc-star-0' | 'esc-star-1' | 'esc-star-33',
    pattern: 'checker' | 'black' | 'white' | 'hlines' | 'vlines',
  ): Buffer {
    const ESC = 0x1b;
    const GS = 0x1d;
    const width = 576;
    const height = 96;
    const widthBytes = Math.ceil(width / 8);

    const pixelBuf = Buffer.alloc(height * widthBytes);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let set = false;
        switch (pattern) {
          case 'checker':
            set = ((Math.floor(x / 24) + Math.floor(y / 24)) % 2) === 0;
            break;
          case 'black':
            set = true;
            break;
          case 'white':
            set = false;
            break;
          case 'hlines':
            set = (y % 4) < 2;
            break;
          case 'vlines':
            set = (x % 4) < 2;
            break;
        }
        if (set) {
          const byteIdx = y * widthBytes + Math.floor(x / 8);
          const bitIdx = 7 - (x % 8);
          pixelBuf[byteIdx] |= (1 << bitIdx);
        }
      }
    }

    const parts: Buffer[] = [];
    parts.push(Buffer.from([ESC, 0x40]));
    parts.push(Buffer.from([ESC, 0x61, 0x00]));

    const density = parseInt(process.env.BIXOLON_DENSITY || '8');
    parts.push(Buffer.from([0x12, 0x23, density & 0xff]));

    if (mode === 'gs-v0') {
      parts.push(Buffer.from([
        GS, 0x76, 0x30, 0x00,
        widthBytes & 0xff, (widthBytes >> 8) & 0xff,
        height & 0xff, (height >> 8) & 0xff,
      ]));
      parts.push(pixelBuf);
    } else {
      const dotsPerStrip = (mode === 'esc-star-33') ? 24 : 9;
      const bytesPerCol = (mode === 'esc-star-33') ? 3 : 1;
      const mParam = (mode === 'esc-star-1') ? 1 : (mode === 'esc-star-33') ? 33 : 0;
      const numStrips = Math.ceil(height / dotsPerStrip);

      for (let strip = 0; strip < numStrips; strip++) {
        const yStart = strip * dotsPerStrip;
        const columnData: number[] = [];
        for (let x = 0; x < width; x++) {
          for (let byteIdx = 0; byteIdx < bytesPerCol; byteIdx++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
              const srcY = yStart + byteIdx * 8 + bit;
              if (srcY < height) {
                const srcByteIndex = srcY * widthBytes + Math.floor(x / 8);
                const srcBitIndex = 7 - (x % 8);
                const bitVal = (pixelBuf[srcByteIndex] >> srcBitIndex) & 1;
                if (bitVal) {
                  byte |= (0x80 >> bit);
                }
              }
            }
            columnData.push(byte);
          }
        }
        const dataLen = columnData.length;
        parts.push(Buffer.from([ESC, 0x2A, mParam, dataLen & 0xff, (dataLen >> 8) & 0xff]));
        parts.push(Buffer.from(columnData));
        parts.push(Buffer.from([0x0A]));
      }
    }

    parts.push(Buffer.from([ESC, 0x32]));
    parts.push(Buffer.from([GS, 0x56, 0x00]));

    return Buffer.concat(parts);
  }

  @Post('bixolon/ticket')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Print ticket on Bixolon' })
  @ApiBody({ type: CreateTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket sent to printer' })
  @ApiResponse({ status: 404, description: 'Printer not found' })
  async printBixolonTicket(@Body() createTicketDto: CreateTicketDto) {
    // TODO: Generate ESC/POS from ticket data
    return { success: true, message: 'Ticket printing not yet implemented' };
  }
}
