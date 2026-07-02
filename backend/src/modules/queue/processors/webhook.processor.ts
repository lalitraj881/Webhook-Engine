import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { RulesService } from '../../rules/rules.service';
import { RuleEngineService } from '../../rules/rule-engine.service';
import { JobsService } from '../../jobs/jobs.service';
import { WebhooksService } from '../../webhooks/webhooks.service';

/**
 * Webhook Processor — consumes jobs from the 'webhook-processing' queue.
 *
 * This is where the async pipeline begins:
 * 1. Receives a webhook event from the queue
 * 2. Finds matching automation rules for the tenant/source/eventType
 * 3. Evaluates rule conditions against the event payload
 * 4. For each matched rule + action, creates a job history entry and
 *    enqueues to the 'action-dispatch' queue
 *
 * If this worker crashes mid-job:
 * - BullMQ's stalled job detection will pick it up after lockDuration expires
 * - The job will be retried automatically (up to 3 times)
 * - This is the key reliability feature the brief asks about
 */
@Processor('webhook-processing', {
  concurrency: 5,
  // Stalled job detection — critical for crash recovery
  lockDuration: 30000,     // 30 seconds
  stalledInterval: 15000,  // Check every 15 seconds
})
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly rulesService: RulesService,
    private readonly ruleEngine: RuleEngineService,
    private readonly jobsService: JobsService,
    private readonly webhooksService: WebhooksService,
    @InjectQueue('action-dispatch') private actionQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const {
      webhookEventId,
      tenantId,
      source,
      eventType,
      payload,
    } = job.data;

    this.logger.log(
      `Processing webhook: event=${webhookEventId}, tenant=${tenantId}, ` +
        `source=${source}, type=${eventType} (attempt ${job.attemptsMade + 1})`,
    );

    try {
      // Update event status to 'processing'
      await this.webhooksService.updateStatus(webhookEventId, 'processing');

      // Step 1: Find all active rules matching this event
      const candidateRules = await this.rulesService.findMatchingRules(
        tenantId,
        source,
        eventType,
      );

      this.logger.log(
        `Found ${candidateRules.length} candidate rules for ${source}/${eventType}`,
      );

      if (candidateRules.length === 0) {
        // No rules match — mark event as processed, nothing to do
        await this.webhooksService.updateStatus(webhookEventId, 'processed');
        return { matchedRules: 0, actionsDispatched: 0 };
      }

      // Step 2: Evaluate rule conditions against the payload
      const matchedRules = this.ruleEngine.evaluate(
        candidateRules,
        payload,
      );

      this.logger.log(
        `${matchedRules.length} of ${candidateRules.length} rules matched payload conditions`,
      );

      // Step 3: For each matched rule, dispatch its actions
      let actionsDispatched = 0;

      for (const rule of matchedRules) {
        for (const action of rule.actions) {
          // Create job history entry for visibility
          const jobHistory = await this.jobsService.createJob({
            tenantId,
            webhookEventId,
            ruleId: (rule as any)._id.toString(),
            ruleName: rule.name,
            actionType: action.type,
            actionConfig: action.config,
            eventPayload: payload,
          });

          // Enqueue action for execution
          await this.actionQueue.add(
            'dispatch-action',
            {
              jobHistoryId: jobHistory._id.toString(),
              tenantId,
              actionType: action.type,
              actionConfig: action.config,
              eventPayload: payload,
              isReplay: false,
            },
            {
              attempts: 3,
              backoff: { type: 'exponential', delay: 5000 },
            },
          );

          actionsDispatched++;
        }
      }

      // Mark event as processed
      await this.webhooksService.updateStatus(webhookEventId, 'processed');

      this.logger.log(
        `Webhook processed: ${matchedRules.length} rules matched, ` +
          `${actionsDispatched} actions dispatched`,
      );

      return {
        matchedRules: matchedRules.length,
        actionsDispatched,
      };
    } catch (error: any) {
      this.logger.error(
        `Error processing webhook ${webhookEventId}: ${error.message}`,
        error.stack,
      );

      // Mark event as failed
      await this.webhooksService.updateStatus(webhookEventId, 'failed');

      // Re-throw so BullMQ handles retry/failure
      throw error;
    }
  }
}
