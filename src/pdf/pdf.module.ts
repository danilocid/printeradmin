import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { PdfRendererService } from './pdf-renderer.service';
import { PrintersModule } from '../printers/printers.module';

@Module({
  imports: [PrintersModule],
  controllers: [PdfController],
  providers: [PdfService, PdfRendererService],
  exports: [PdfService],
})
export class PdfModule {}
