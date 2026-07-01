import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Records each attempt to execute an action.
 * Stored as an array within JobHistory for full visibility into retry behavior.
 */
export class JobAttempt {
  @Prop({ required: true })
  attemptNumber!: number;

  @Prop({ required: true })
  startedAt!: Date;

  @Prop()
  completedAt?: Date;

  @Prop({ required: true, enum: ['success', 'failure'] })
  status!: string;

  /** Successful response data */
  @Prop({ type: Object })
  result?: Record<string, any>;

  /** Failure details — error message, HTTP status, stack trace */
  @Prop({ type: Object })
  error?: {
    message: string;
    code?: string;
    httpStatus?: number;
    stack?: string;
  };
}

export type JobHistoryDocument = JobHistory & Document;

@Schema({ timestamps: true, collection: 'job_history' })
export class JobHistory {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WebhookEvent', required: true })
  webhookEventId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AutomationRule' })
  ruleId?: Types.ObjectId;

  /** Denormalized for display — avoids JOIN/populate in list views */
  @Prop({ required: true })
  ruleName!: string;

  /** Correlation ID from BullMQ for debugging */
  @Prop()
  bullJobId?: string;

  @Prop({
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed', 'retrying'],
    default: 'pending',
  })
  status!: string;

  @Prop({ required: true, enum: ['webhook', 'email', 'log'] })
  actionType!: string;

  @Prop({ type: Object, required: true })
  actionConfig!: Record<string, any>;

  /** Original event payload — stored here so replays have the exact same data */
  @Prop({ type: Object, required: true })
  eventPayload!: Record<string, any>;

  /** Full attempt history for visibility */
  @Prop({ type: [JobAttempt], default: [] })
  attempts!: JobAttempt[];

  @Prop()
  completedAt?: Date;

  /** Whether this job is a replay of a previous failed job */
  @Prop({ default: false })
  isReplay!: boolean;

  /** Link to the original job if this is a replay */
  @Prop({ type: Types.ObjectId, ref: 'JobHistory' })
  originalJobId?: Types.ObjectId;
}

export const JobHistorySchema = SchemaFactory.createForClass(JobHistory);

// Indexes for tenant-scoped dashboard queries
JobHistorySchema.index({ tenantId: 1, status: 1, createdAt: -1 });
JobHistorySchema.index({ tenantId: 1, webhookEventId: 1 });
JobHistorySchema.index({ tenantId: 1, ruleId: 1 });
