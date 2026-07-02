import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { JobHistory, JobHistoryDocument } from './schemas/job-history.schema';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectModel(JobHistory.name)
    private jobHistoryModel: Model<JobHistoryDocument>,
    @InjectQueue('action-dispatch') private actionQueue: Queue,
  ) {}

  /** Create a new job history entry */
  async createJob(data: {
    tenantId: string;
    webhookEventId: string;
    ruleId: string;
    ruleName: string;
    actionType: string;
    actionConfig: Record<string, any>;
    eventPayload: Record<string, any>;
  }): Promise<JobHistoryDocument> {
    const job = await this.jobHistoryModel.create({
      tenantId: new Types.ObjectId(data.tenantId),
      webhookEventId: new Types.ObjectId(data.webhookEventId),
      ruleId: new Types.ObjectId(data.ruleId),
      ruleName: data.ruleName,
      status: 'pending',
      actionType: data.actionType,
      actionConfig: data.actionConfig,
      eventPayload: data.eventPayload,
      attempts: [],
      isReplay: false,
    });

    this.logger.log(
      `Job created: ${job._id} for rule "${data.ruleName}" (${data.actionType})`,
    );
    return job;
  }

  /** Update job status */
  async updateJobStatus(
    jobId: string,
    status: string,
    attemptData?: {
      attemptNumber: number;
      startedAt: Date;
      completedAt?: Date;
      status: string;
      result?: Record<string, any>;
      error?: { message: string; code?: string; httpStatus?: number; stack?: string };
    },
  ): Promise<void> {
    const setFields: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'completed' || status === 'failed') {
      setFields.completedAt = new Date();
    }

    const updateQuery: Record<string, unknown> = { $set: setFields };
    if (attemptData) {
      updateQuery.$push = { attempts: attemptData };
    }

    await this.jobHistoryModel.updateOne(
      { _id: new Types.ObjectId(jobId) },
      updateQuery,
    );
  }

  /** List jobs for a tenant with filtering */
  async findByTenant(
    tenantId: string,
    filters: { status?: string; page?: number; limit?: number } = {},
  ): Promise<{ data: JobHistoryDocument[]; total: number }> {
    const { status, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const query: any = { tenantId: new Types.ObjectId(tenantId) };
    if (status) {
      query.status = status;
    }

    const [data, total] = await Promise.all([
      this.jobHistoryModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.jobHistoryModel.countDocuments(query),
    ]);

    return { data: data as unknown as JobHistoryDocument[], total };
  }

  /** Get a single job — tenant-scoped */
  async findOne(
    tenantId: string,
    jobId: string,
  ): Promise<JobHistoryDocument | null> {
    return this.jobHistoryModel
      .findOne({
        _id: new Types.ObjectId(jobId),
        tenantId: new Types.ObjectId(tenantId),
      })
      .lean()
      .exec() as any;
  }

  /**
   * Replay a failed job.
   * Creates a new job history entry linked to the original,
   * then enqueues it to the action-dispatch queue.
   */
  async replayJob(
    tenantId: string,
    jobId: string,
  ): Promise<JobHistoryDocument> {
    const originalJob = await this.jobHistoryModel.findOne({
      _id: new Types.ObjectId(jobId),
      tenantId: new Types.ObjectId(tenantId),
      status: 'failed',
    });

    if (!originalJob) {
      throw new NotFoundException(
        'Job not found, does not belong to this tenant, or is not in failed status',
      );
    }

    // Create a new job history entry for the replay
    const replayJob = await this.jobHistoryModel.create({
      tenantId: originalJob.tenantId,
      webhookEventId: originalJob.webhookEventId,
      ruleId: originalJob.ruleId,
      ruleName: originalJob.ruleName,
      status: 'pending',
      actionType: originalJob.actionType,
      actionConfig: originalJob.actionConfig,
      eventPayload: originalJob.eventPayload,
      attempts: [],
      isReplay: true,
      originalJobId: originalJob._id,
    });

    // Enqueue to action-dispatch queue
    await this.actionQueue.add(
      'dispatch-action',
      {
        jobHistoryId: replayJob._id.toString(),
        tenantId: tenantId,
        actionType: originalJob.actionType,
        actionConfig: originalJob.actionConfig,
        eventPayload: originalJob.eventPayload,
        isReplay: true,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    this.logger.log(
      `Replaying job ${jobId} as new job ${replayJob._id}`,
    );

    return replayJob;
  }

  /** Get summary stats for a tenant — used by the dashboard */
  async getStats(
    tenantId: string,
  ): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const tid = new Types.ObjectId(tenantId);
    const [total, pending, processing, completed, failed] = await Promise.all([
      this.jobHistoryModel.countDocuments({ tenantId: tid }),
      this.jobHistoryModel.countDocuments({ tenantId: tid, status: 'pending' }),
      this.jobHistoryModel.countDocuments({ tenantId: tid, status: 'processing' }),
      this.jobHistoryModel.countDocuments({ tenantId: tid, status: 'completed' }),
      this.jobHistoryModel.countDocuments({ tenantId: tid, status: 'failed' }),
    ]);
    return { total, pending, processing, completed, failed };
  }
}
