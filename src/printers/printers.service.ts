import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrinterDriver, PrinterStatus } from './interfaces/printer-driver.interface';

@Injectable()
export class PrintersService {
  private readonly logger = new Logger(PrintersService.name);
  private readonly printers: Map<string, PrinterDriver> = new Map();

  constructor(
    @Inject('BIXOLON_DRIVER') private readonly bixolonDriver: PrinterDriver,
    @Inject('XPRINTER_DRIVER') private readonly xprinterDriver: PrinterDriver,
  ) {
    this.printers.set('bixolon', this.bixolonDriver);
    this.printers.set('xprinter', this.xprinterDriver);
  }

  listPrinters() {
    return [
      { id: 'bixolon', name: 'BIXOLON SRP-E300', type: 'receipt' },
      { id: 'xprinter', name: 'XPrinter XP-420B', type: 'label' },
    ];
  }

  async getStatus(printerId: string): Promise<PrinterStatus> {
    const driver = this.printers.get(printerId);
    if (!driver) {
      throw new Error(`Printer ${printerId} not found`);
    }
    return driver.getStatus();
  }

  async printRaw(printerId: string, data: Buffer): Promise<void> {
    const driver = this.printers.get(printerId);
    if (!driver) {
      throw new Error(`Printer ${printerId} not found`);
    }
    return driver.printRaw(data);
  }

  getDriver(printerId: string): PrinterDriver | undefined {
    return this.printers.get(printerId);
  }
}
