import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { PrinterDriver, PrinterStatus } from '../../interfaces/printer-driver.interface';

@Injectable()
export class XPrinterDriver implements PrinterDriver {
  private readonly logger = new Logger(XPrinterDriver.name);
  private readonly devicePath: string;

  constructor() {
    this.devicePath = process.env.XPRINTER_DEVICE || '/dev/usb/lp1';
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
    if (status.status !== 'ready') {
      throw new Error(`Printer is not ready: ${status.status}`);
    }

    try {
      const fd = await fs.promises.open(this.devicePath, 'w');
      try {
        await fd.write(data);
      } finally {
        await fd.close();
      }
      this.logger.log(`Printed ${data.length} bytes to ${this.devicePath}`);
    } catch (error) {
      this.logger.error(`Failed to print to ${this.devicePath}: ${error.message}`);
      throw error;
    }
  }
}
