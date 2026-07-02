import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  WebhookEvent,
  WebhookEventDocument,
} from './schemas/webhook-event.schema';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectModel(WebhookEvent.name)
    private webhookEventModel: Model<WebhookEventDocument>,
    @InjectQueue('webhook-processing') private webhookQueue: Queue,
  ) {}

  /**
   * Ingest a new webhook event:
   * 1. Store the raw event in MongoDB (with idempotency key for secondary dedup)
   * 2. Enqueue the event to BullMQ for async rule evaluation
   * 3. Return immediately for fast 200 ACK
   */
  async ingest(data: {
    tenantId: string;
    source: string;
    eventType: string;
    payload: Record<string, any>;
    headers: Record<string, string>;
    idempotencyKey: string;
  }): Promise<WebhookEventDocument> {
    const now = new Date();

    // Step 1: Store raw event in MongoDB
    let event: WebhookEventDocument;
    try {
      event = await this.webhookEventModel.create({
        tenantId: new Types.ObjectId(data.tenantId),
        source: data.source,
        eventType: data.eventType,
        idempotencyKey: data.idempotencyKey,
        headers: data.headers,
        payload: data.payload,
        status: 'received',
        receivedAt: now,
      });
    } catch (error: any) {
      // MongoDB unique index catch — secondary dedup safety net
      if (error.code === 11000) {
        this.logger.warn(
          `MongoDB dedup caught duplicate: ${data.idempotencyKey}`,
        );
        const existing = await this.webhookEventModel.findOne({
          idempotencyKey: data.idempotencyKey,
        });
        return existing as WebhookEventDocument;
      }
      throw error;
    }

    // Step 2: Enqueue for async processing
    const job = await this.webhookQueue.add(
      'process-webhook',
      {
        webhookEventId: event._id.toString(),
        tenantId: data.tenantId,
        source: data.source,
        eventType: data.eventType,
        payload: data.payload,
        idempotencyKey: data.idempotencyKey,
        receivedAt: now.toISOString(),
      },
      {
        // Job ID based on idempotency key — BullMQ dedup layer
        // Note: BullMQ strictly forbids colons (:) in custom job IDs
        jobId: `wh-${data.idempotencyKey.replace(/:/g, '-')}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    this.logger.log(
      `Webhook ingested: event=${event._id}, job=${job.id}, key=${data.idempotencyKey}`,
    );

    return event;
  }

  /** List all webhook events for a tenant (paginated) */
  async findByTenant(
    tenantId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: WebhookEventDocument[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.webhookEventModel
        .find({ tenantId: new Types.ObjectId(tenantId) })
        .sort({ receivedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.webhookEventModel.countDocuments({
        tenantId: new Types.ObjectId(tenantId),
      }),
    ]);
    return { data: data as unknown as WebhookEventDocument[], total };
  }

  /** Get a single event by ID — tenant-scoped */
  async findOne(
    tenantId: string,
    eventId: string,
  ): Promise<WebhookEventDocument | null> {
    return this.webhookEventModel
      .findOne({
        _id: new Types.ObjectId(eventId),
        tenantId: new Types.ObjectId(tenantId),
      })
      .lean()
      .exec() as any;
  }

  /** Update event status */
  async updateStatus(eventId: string, status: string): Promise<void> {
    const update: any = { status };
    if (status === 'processed') {
      update.processedAt = new Date();
    }
    await this.webhookEventModel.updateOne(
      { _id: new Types.ObjectId(eventId) },
      { $set: update },
    );
  }
}
