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
    const outputFile = path.join(tempDir, `rendered_${Date.now()}.png`);

    try {
      const widthArg = width ? `-r ${Math.floor(width * 72 / 576)}` : '';
      const cmd = `pdftoppm -png -singlefile ${widthArg} "${pdfPath}" "${outputFile.replace('.png', '')}"`;
      
      this.logger.debug(`Executing: ${cmd}`);
      await execAsync(cmd);

      if (!fs.existsSync(outputFile)) {
        throw new Error('Failed to render PDF');
      }

      return outputFile;
    } catch (error) {
      this.logger.error(`PDF rendering failed: ${error.message}`);
      throw error;
    }
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
