import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    // Raw body needed for HMAC signature verification
    rawBody: true,
  });

  // Body size limit — reject oversized payloads (1MB max)
  // This runs BEFORE any controller logic to protect against abuse
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // Global exception filter — prevents raw stack traces from leaking to clients
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation pipe — rejects malformed payloads before they touch the DB
  // whitelist: strips unknown properties
  // forbidNonWhitelisted: throws error on unknown properties
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

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 Webhook Engine running on http://localhost:${port}`);
  logger.log(`📡 Webhook endpoint: POST /webhooks/:tenantId/:source`);
  logger.log(`📊 API endpoint: GET /api/*`);
}
bootstrap();
