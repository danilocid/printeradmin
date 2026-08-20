import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PrintRawDto {
  @ApiProperty({ description: 'Hex-encoded raw data to print' })
  @IsString()
  @IsNotEmpty()
  data: string;
}
