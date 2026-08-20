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

    const dpi = 203;
    const cmd = `pdftoppm -mono -r ${dpi} -singlefile "${pdfPath}" "${outputBase}"`;

    this.logger.log(`[RENDERER] Executing pdftoppm: ${cmd}`);
    this.logger.log(`[RENDERER] Source PDF: "${pdfPath}" (exists=${fs.existsSync(pdfPath)})`);
    const { stdout, stderr } = await execAsync(cmd);
    if (stdout) this.logger.log(`[RENDERER] pdftoppm stdout: ${stdout}`);
    if (stderr) this.logger.warn(`[RENDERER] pdftoppm stderr: ${stderr}`);

    const outputFile = `${outputBase}.pbm`;
    if (!fs.existsSync(outputFile)) {
      this.logger.error(`[RENDERER] PBM output file not found at "${outputBase}.pbm". pdftoppm may have failed.`);
      throw new Error(`Failed to render PDF: output file not created at "${outputBase}.pbm"`);
    }
    const stat = await fs.promises.stat(outputFile);
    this.logger.log(`[RENDERER] PBM output created: "${outputFile}" (${stat.size} bytes)`);

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
