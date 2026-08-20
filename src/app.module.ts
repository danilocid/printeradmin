import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './health/health.module';
import { PrintersModule } from './printers/printers.module';
import { JobsModule } from './jobs/jobs.module';
import { PdfModule } from './pdf/pdf.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: { singleLine: true },
        },
      },
    }),
    CommonModule,
    HealthModule,
    PrintersModule,
    JobsModule,
    PdfModule,
  ],
})
export class AppModule {}
