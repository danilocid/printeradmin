import { IsString, IsNotEmpty, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class TicketItem {
  @ApiProperty({ description: 'Product name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ description: 'Price' })
  @IsNumber()
  price: number;
}

export class CreateTicketDto {
  @ApiProperty({ description: 'Store name' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Subtitle or sale number' })
  @IsString()
  subtitle: string;

  @ApiProperty({ description: 'Ticket items', type: [TicketItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketItem)
  items: TicketItem[];

  @ApiProperty({ description: 'Total amount' })
  @IsNumber()
  total: number;
}
