import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PdfRendererService } from './pdf-renderer.service';
import { JobsService } from '../jobs/jobs.service';
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
    private readonly jobsService: JobsService,
    private readonly printersService: PrintersService,
  ) {}

  async processPdf(printerId: string, file: MultipartFile) {
    const job = this.jobsService.createJob(printerId, 'pdf', {
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    });

    const tempDir = path.join(os.tmpdir(), `print-server-${job.id}`);
    await fs.promises.mkdir(tempDir, { recursive: true });

    const pdfPath = path.join(tempDir, file.originalname);
    await fs.promises.writeFile(pdfPath, file.buffer);

    try {
      const width = printerId === 'bixolon' 
        ? parseInt(process.env.BIXOLON_WIDTH || '576')
        : parseInt(process.env.XPRINTER_WIDTH || '400');

      const imagePath = await this.pdfRendererService.renderPdfToImage(pdfPath, '', width);
      
      // TODO: Convert image to ESC/POS or appropriate format
      // For now, just log that we would print
      this.logger.log(`PDF processed for printer ${printerId}, image: ${imagePath}`);
      
      await this.pdfRendererService.cleanup(imagePath);
    } catch (error) {
      this.logger.error(`Failed to process PDF: ${error.message}`);
      throw error;
    } finally {
      await this.pdfRendererService.cleanup(pdfPath);
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }

    return { jobId: job.id };
  }
}
