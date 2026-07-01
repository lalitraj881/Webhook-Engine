import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { TenantsModule } from './modules/tenants/tenants.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { RulesModule } from './modules/rules/rules.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { QueueModule } from './modules/queue/queue.module';
import { SeedModule } from './seed/seed.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

@Module({
  imports: [
    // Environment configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // MongoDB connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI', 'mongodb://localhost:27017/webhook-engine'),
      }),
      inject: [ConfigService],
    }),

    // BullMQ + Redis connection
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD', ''),
          maxRetriesPerRequest: null, // Required by BullMQ
        },
      }),
      inject: [ConfigService],
    }),

    // Feature modules
    TenantsModule,
    WebhooksModule,
    RulesModule,
    JobsModule,
    QueueModule,
    SeedModule,
  ],
})
export class AppModule implements NestModule {
  /**
   * Apply TenantMiddleware to all API routes that need tenant context.
   * Webhook ingestion routes extract tenantId from the URL, so they don't need this.
   * The /api/tenants route is excluded because it needs to work without a tenant header.
   */
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'api/tenants', method: RequestMethod.ALL },
        { path: 'api/tenants/(.*)', method: RequestMethod.ALL },
        { path: 'webhooks/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes(
        { path: 'api/*', method: RequestMethod.ALL },
      );
  }
}
