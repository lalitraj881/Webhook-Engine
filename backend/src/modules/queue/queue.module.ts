import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhookProcessor } from './processors/webhook.processor';
import { ActionProcessor } from './processors/action.processor';
import { ActionFactory } from './actions/action.factory';
import { WebhookActionHandler } from './actions/webhook.action';
import { EmailActionHandler } from './actions/email.action';
import { LogActionHandler } from './actions/log.action';
import { RulesModule } from '../rules/rules.module';
import { JobsModule } from '../jobs/jobs.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

/**
 * Queue module wiring up BullMQ processors and action handlers.
 *
 * Architecture note: This module imports RulesModule, JobsModule, and WebhooksModule
 * because the processors need to access their services. This creates a clean
 * dependency graph: Queue → Rules/Jobs/Webhooks → MongoDB.
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'webhook-processing' },
      { name: 'action-dispatch' },
    ),
    RulesModule,
    JobsModule,
    WebhooksModule,
  ],
  providers: [
    // Processors (BullMQ workers)
    WebhookProcessor,
    ActionProcessor,
    // Action handlers
    ActionFactory,
    WebhookActionHandler,
    EmailActionHandler,
    LogActionHandler,
  ],
  exports: [ActionFactory],
})
export class QueueModule {}
