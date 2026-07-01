import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    // Raw body needed for HMAC signature verification
    rawBody: true,
  });

  // Global validation pipe — rejects malformed payloads before they touch the DB
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // Body size limit — reject oversized payloads
  app.useGlobalPipes(new ValidationPipe());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 Webhook Engine running on http://localhost:${port}`);
  logger.log(`📡 Webhook endpoint: POST /webhooks/:tenantId/:source`);
  logger.log(`📊 API endpoint: GET /api/*`);
}
bootstrap();
