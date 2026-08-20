import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { PdfRendererService } from './pdf-renderer.service';
import { PrintersModule } from '../printers/printers.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [PrintersModule, JobsModule],
  controllers: [PdfController],
  providers: [PdfService, PdfRendererService],
  exports: [PdfService],
})
export class PdfModule {}
