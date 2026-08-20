import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { PrinterDriver, PrinterStatus } from '../../interfaces/printer-driver.interface';

@Injectable()
export class BixolonDriver implements PrinterDriver {
  private readonly logger = new Logger(BixolonDriver.name);
  private readonly devicePath: string;

  constructor() {
    this.devicePath = process.env.BIXOLON_DEVICE || '/dev/usb/lp0';
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
    this.logger.log(`[DRIVER] Printer status: ${status.status} (device: ${this.devicePath})`);
    if (status.status !== 'ready') {
      throw new Error(`Printer is not ready: ${status.status}`);
    }

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
