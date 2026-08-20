import { Controller, Post, HttpCode, HttpStatus, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiConsumes } from '@nestjs/swagger';
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
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'PDF sent to printer' })
  async printBixolonPdf(@Req() request: FastifyRequest) {
    const file = await this.extractFile(request);
    return this.pdfService.processPdf('bixolon', file);
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
      const parts = (request as any).files();
      if (!parts) {
        throw new BadRequestException('No multipart data found');
      }

      for await (const file of parts) {
        const buffer = await file.toBuffer();
        return {
          fieldname: file.fieldname,
          originalname: file.filename,
          encoding: file.encoding,
          mimetype: file.mimetype,
          buffer,
          size: buffer.length,
        };
      }

      throw new BadRequestException('No file uploaded');
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to process upload: ' + error.message);
    }
  }
}
