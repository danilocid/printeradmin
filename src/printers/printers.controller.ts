import { Controller, Get, Post, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { PrintersService } from './printers.service';
import { PrintRawDto } from './dto/print-raw.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';

@ApiTags('printers')
@Controller('printers')
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  @Get()
  @ApiOperation({ summary: 'List all printers' })
  @ApiResponse({ status: 200, description: 'List of printers' })
  listPrinters() {
    return {
      printers: this.printersService.listPrinters(),
    };
  }

  @Get(':printerId/status')
  @ApiOperation({ summary: 'Get printer status' })
  @ApiParam({ name: 'printerId', description: 'Printer ID' })
  @ApiResponse({ status: 200, description: 'Printer status' })
  @ApiResponse({ status: 404, description: 'Printer not found' })
  async getStatus(@Param('printerId') printerId: string) {
    const status = await this.printersService.getStatus(printerId);
    return {
      printer: printerId,
      status: status.status,
    };
  }

  @Post(':printerId/raw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Print raw data' })
  @ApiParam({ name: 'printerId', description: 'Printer ID' })
  @ApiBody({ type: PrintRawDto })
  @ApiResponse({ status: 200, description: 'Raw data sent to printer' })
  @ApiResponse({ status: 404, description: 'Printer not found' })
  async printRaw(
    @Param('printerId') printerId: string,
    @Body() printRawDto: PrintRawDto,
  ) {
    const data = Buffer.from(printRawDto.data, 'hex');
    await this.printersService.printRaw(printerId, data);
    return { success: true };
  }

  @Post('bixolon/ticket')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Print ticket on Bixolon' })
  @ApiBody({ type: CreateTicketDto })
  @ApiResponse({ status: 200, description: 'Ticket sent to printer' })
  @ApiResponse({ status: 404, description: 'Printer not found' })
  async printBixolonTicket(@Body() createTicketDto: CreateTicketDto) {
    // TODO: Generate ESC/POS from ticket data
    return { success: true, message: 'Ticket printing not yet implemented' };
  }
}
