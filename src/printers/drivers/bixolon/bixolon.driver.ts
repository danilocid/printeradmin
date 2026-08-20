import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { PrinterDriver, PrinterStatus } from '../../interfaces/printer-driver.interface';

@Injectable()
export class BixolonDriver implements PrinterDriver {
  private readonly logger = new Logger(BixolonDriver.name);
  private readonly devicePath: string;
  private readonly useDd: boolean;

  constructor() {
    this.devicePath = process.env.BIXOLON_DEVICE || '/dev/usb/lp0';
    this.useDd = process.env.BIXOLON_USE_DD !== 'false';
  }

  async getStatus(): Promise<PrinterStatus> {
    try {
      await fs.promises.access(this.devicePath, fs.constants.W_OK);
      return { status: 'ready' };
    } catch (error) {
      this.logger.warn(`Printer ${this.devicePath} not accessible: ${error.message}`);
      return { status: 'offline' };
    }
  }

  async printRaw(data: Buffer): Promise<void> {
    const status = await this.getStatus();
    this.logger.log(`[DRIVER] Printer status: ${status.status} (device: ${this.devicePath}, dd=${this.useDd})`);
    if (status.status !== 'ready') {
      throw new Error(`Printer is not ready: ${status.status}`);
    }

    if (this.useDd) {
      await this.printViaDd(data);
    } else {
      await this.printViaFd(data);
    }
  }

  private async printViaDd(data: Buffer): Promise<void> {
    const tmpFile = path.join(os.tmpdir(), `print-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
    try {
      this.logger.log(`[DRIVER] Writing ${data.length} bytes to temp file "${tmpFile}"...`);
      await fs.promises.writeFile(tmpFile, data);

      const cmd = `dd if="${tmpFile}" of="${this.devicePath}" bs=1024 conv=sync 2>&1`;
      this.logger.log(`[DRIVER] Executing: ${cmd}`);
      const output = execSync(cmd, { timeout: 30000, encoding: 'utf-8' });
      this.logger.log(`[DRIVER] dd output: ${output.replace(/\n/g, ' | ')}`);

      this.logger.log(`[DRIVER] Successfully printed ${data.length} bytes via dd to ${this.devicePath}`);
    } catch (error) {
      this.logger.error(`[DRIVER] dd write failed: ${error.message}`, error.stack);
      this.logger.log(`[DRIVER] Falling back to fd.write()...`);
      await this.printViaFd(data);
    } finally {
      try { await fs.promises.unlink(tmpFile); } catch {}
    }
  }

  private async printViaFd(data: Buffer): Promise<void> {
    try {
      this.logger.log(`[DRIVER] Opening device "${this.devicePath}" for write (${data.length} bytes)...`);
      const fd = await fs.promises.open(this.devicePath, 'w');
      try {
        this.logger.log(`[DRIVER] Device opened, writing ${data.length} bytes...`);
        const { bytesWritten } = await fd.write(data);
        this.logger.log(`[DRIVER] Write complete: ${bytesWritten}/${data.length} bytes written`);
      } finally {
        await fd.close();
        this.logger.log(`[DRIVER] Device closed`);
      }
      this.logger.log(`[DRIVER] Successfully printed ${data.length} bytes to ${this.devicePath}`);
    } catch (error) {
      this.logger.error(`[DRIVER] Failed to print to ${this.devicePath}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
