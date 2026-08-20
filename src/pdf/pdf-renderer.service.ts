import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

@Injectable()
export class PdfRendererService {
  private readonly logger = new Logger(PdfRendererService.name);

  async renderPdfToImage(pdfPath: string, outputPath: string, width?: number): Promise<string> {
    const tempDir = os.tmpdir();
    const outputBase = path.join(tempDir, `rendered_${Date.now()}`);

    const dpi = width ? Math.floor((width / 80) * 203) : 203;
    const cmd = `pdftoppm -mono -r ${dpi} -singlefile "${pdfPath}" "${outputBase}"`;

    this.logger.debug(`Executing: ${cmd}`);
    await execAsync(cmd);

    const outputFile = `${outputBase}.pbm`;
    if (!fs.existsSync(outputFile)) {
      throw new Error('Failed to render PDF');
    }

    return outputFile;
  }

  async cleanup(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        this.logger.debug(`Cleaned up file: ${filePath}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup file ${filePath}: ${error.message}`);
    }
  }
}
