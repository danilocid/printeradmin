import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyMultipart from '@fastify/multipart';

export class CustomFastifyAdapter extends FastifyAdapter {
  constructor() {
    super();
    this.getInstance().register(fastifyMultipart, {
      limits: {
        fileSize: parseInt(process.env.MAX_PDF_SIZE_MB || '10') * 1024 * 1024,
      },
    });
  }
}
