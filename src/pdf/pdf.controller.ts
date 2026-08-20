import { Controller, Post, HttpCode, HttpStatus, Req, BadRequestException, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { PdfService } from './pdf.service';
import { FastifyRequest } from 'fastify';

interface MultipartFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@ApiTags('pdf')
@Controller('printers')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('bixolon/pdf')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Print PDF on Bixolon' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'mode', required: false, enum: ['gs-v0', 'esc-star-0', 'esc-star-1', 'esc-star-33'], description: 'ESC/POS image command mode' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'PDF sent to printer' })
  async printBixolonPdf(
    @Req() request: FastifyRequest,
    @Query('mode') mode?: 'gs-v0' | 'esc-star-0' | 'esc-star-1' | 'esc-star-33',
  ) {
    const file = await this.extractFile(request);
    return this.pdfService.processPdf('bixolon', file, mode || 'gs-v0');
  }

  @Post('xprinter/pdf')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Print PDF on XPrinter' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'PDF sent to printer' })
  async printXprinterPdf(@Req() request: FastifyRequest) {
    const file = await this.extractFile(request);
    return this.pdfService.processPdf('xprinter', file);
  }

  private async extractFile(request: FastifyRequest): Promise<MultipartFile> {
    try {
      const data = await request.file();
      if (!data) {
        throw new BadRequestException('No file uploaded');
      }

      const buffer = await data.toBuffer();
      return {
        fieldname: data.fieldname,
        originalname: data.filename,
        encoding: data.encoding,
        mimetype: data.mimetype,
        buffer,
        size: buffer.length,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to process upload: ' + error.message);
    }
  }
}
