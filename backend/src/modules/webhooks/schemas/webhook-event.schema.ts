import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WebhookEventDocument = WebhookEvent & Document;

@Schema({ timestamps: true, collection: 'webhook_events' })
export class WebhookEvent {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  /** Platform source, e.g. 'shopify', 'stripe', 'crm' */
  @Prop({ required: true, lowercase: true, trim: true })
  source!: string;

  /** Event type, e.g. 'order.created', 'payment.failed' */
  @Prop({ required: true, trim: true })
  eventType!: string;

  /**
   * Composite idempotency key: `${tenantId}:${source}:${eventId}`
   * Used as a secondary dedup safety net (primary is Redis SETNX).
   */
  @Prop({ required: true, unique: true })
  idempotencyKey!: string;

  /** Raw request headers — useful for debugging signature issues */
  @Prop({ type: Object, default: {} })
  headers!: Record<string, string>;

  /** Raw event payload from the external platform */
  @Prop({ type: Object, required: true })
  payload!: Record<string, any>;

  /** Processing status of this event */
  @Prop({
    required: true,
    enum: ['received', 'processing', 'processed', 'failed'],
    default: 'received',
  })
  status!: string;

  @Prop()
  receivedAt!: Date;

  @Prop()
  processedAt?: Date;
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);

// Indexes for efficient tenant-scoped queries
WebhookEventSchema.index({ tenantId: 1, receivedAt: -1 });
WebhookEventSchema.index({ idempotencyKey: 1 }, { unique: true });
WebhookEventSchema.index({ tenantId: 1, source: 1, eventType: 1 });
