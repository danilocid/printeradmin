export interface PrinterStatus {
  status: 'ready' | 'offline' | 'error' | 'unknown';
}

export interface PrinterDriver {
  getStatus(): Promise<PrinterStatus>;
  printRaw(data: Buffer): Promise<void>;
}
