import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { WebhookEvent, WebhookEventSchema } from './schemas/webhook-event.schema';
import { WebhooksController } from './webhooks.controller';
import { EventsController } from './events.controller';
import { WebhooksService } from './webhooks.service';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WebhookEvent.name, schema: WebhookEventSchema },
    ]),
    BullModule.registerQueue({
      name: 'webhook-processing',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: false,
      },
    }),
  ],
  controllers: [WebhooksController, EventsController],
  providers: [WebhooksService, IdempotencyInterceptor],
  exports: [WebhooksService],
})
export class WebhooksModule {}
