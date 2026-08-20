import { Module } from '@nestjs/common';
import { PrintersController } from './printers.controller';
import { PrintersService } from './printers.service';
import { BixolonDriver } from './drivers/bixolon/bixolon.driver';
import { XPrinterDriver } from './drivers/xprinter/xprinter.driver';

@Module({
  controllers: [PrintersController],
  providers: [
    PrintersService,
    {
      provide: 'BIXOLON_DRIVER',
      useClass: BixolonDriver,
    },
    {
      provide: 'XPRINTER_DRIVER',
      useClass: XPrinterDriver,
    },
  ],
  exports: [PrintersService],
})
export class PrintersModule {}
