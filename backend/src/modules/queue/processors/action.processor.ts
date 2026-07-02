import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JobsService } from '../../jobs/jobs.service';
import { ActionFactory } from '../actions/action.factory';

/**
 * Action Dispatcher — consumes jobs from the 'action-dispatch' queue.
 *
 * Design decision: Separating action dispatch into its own queue provides:
 * 1. Independent scaling — webhook processing and action execution scale separately
 * 2. Isolation — a slow downstream API doesn't block rule evaluation
 * 3. Per-action retry policies — webhook actions may need different retry
 *    strategies than email actions
 *
 * This worker:
 * 1. Picks up an action job from the queue
 * 2. Updates the job status to 'processing'
 * 3. Executes the action via the ActionFactory
 * 4. Records the attempt result (success or failure details)
 * 5. Updates final status to 'completed' or 'failed'
 */
@Processor('action-dispatch', {
  concurrency: 10,
  lockDuration: 60000,     // 60 seconds (actions may take longer, e.g. HTTP calls)
  stalledInterval: 30000,
})
export class ActionProcessor extends WorkerHost {
  private readonly logger = new Logger(ActionProcessor.name);

  constructor(
    private readonly jobsService: JobsService,
    private readonly actionFactory: ActionFactory,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const {
      jobHistoryId,
      tenantId,
      actionType,
      actionConfig,
      eventPayload,
      isReplay,
    } = job.data;

    const attemptNumber = job.attemptsMade + 1;
    const startedAt = new Date();

    this.logger.log(
      `Executing action: job=${jobHistoryId}, type=${actionType}, ` +
        `attempt=${attemptNumber}${isReplay ? ' (REPLAY)' : ''}`,
    );

    // Update job status to 'processing'
    await this.jobsService.updateJobStatus(jobHistoryId, 'processing');

    try {
      // Execute the action through the factory
      const result = await this.actionFactory.execute(
        actionType,
        actionConfig,
        eventPayload,
      );

      if (result.success) {
        // Record successful attempt
        await this.jobsService.updateJobStatus(jobHistoryId, 'completed', {
          attemptNumber,
          startedAt,
          completedAt: new Date(),
          status: 'success',
          result: result.data,
        });

        this.logger.log(
          `Action completed successfully: job=${jobHistoryId}, type=${actionType}`,
        );

        return { status: 'completed', result: result.data };
      } else {
        // Action returned failure (but didn't throw)
        const error = result.error || {
          message: 'Action returned failure without error details',
          code: 'UNKNOWN'
        };

        // Throw an error to let the catch block handle the recording and retry
        const execError = new Error(
          `Action failed: ${error.message} (code: ${error.code || 'UNKNOWN'})`
        );
        (execError as any).code = error.code;
        throw execError;
      }
    } catch (error: any) {
      this.logger.error(
        `Action failed: job=${jobHistoryId}, type=${actionType}, ` +
          `attempt=${attemptNumber}, error=${error.message}`,
      );

      // Record the failed attempt (both graceful failures and unexpected exceptions)
      await this.jobsService.updateJobStatus(
        jobHistoryId,
        attemptNumber >= (job.opts.attempts || 3) ? 'failed' : 'retrying',
        {
          attemptNumber,
          startedAt,
          completedAt: new Date(),
          status: 'failure',
          error: {
            message: error.message,
            code: error.code || 'EXECUTION_ERROR',
            stack: error.stack,
          },
        }
      );

      // Re-throw for BullMQ retry mechanism
      throw error;
    }
  }
}
