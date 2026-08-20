import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { CustomFastifyAdapter } from './common/adapters/custom-fastify.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new CustomFastifyAdapter(),
    { cors: true }
  );

  app.useLogger(app.get(Logger));
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const apiGuard = app.get(ApiKeyGuard);
  app.useGlobalGuards(apiGuard);

  const config = new DocumentBuilder()
    .setTitle('Print Server')
    .setDescription('Print Server API for Raspberry Pi')
    .setVersion('1.0')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'Print Server API',
  });

  const port = process.env.PORT || 8080;
  await app.listen(port, '0.0.0.0');
  
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
