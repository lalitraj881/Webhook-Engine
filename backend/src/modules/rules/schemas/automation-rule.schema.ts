import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * A single condition within a rule's trigger.
 * Example: { field: 'order.total_price', operator: 'greater_than', value: 500 }
 */
export class Condition {
  @Prop({ required: true })
  field!: string;

  @Prop({ required: true, enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'exists'] })
  operator!: string;

  @Prop({ type: Object })
  value?: any;
}

/**
 * An action to execute when a rule matches.
 * Each rule can trigger multiple actions (e.g., send webhook AND email).
 */
export class ActionConfig {
  @Prop({ required: true, enum: ['webhook', 'email', 'log'] })
  type!: string;

  @Prop({ type: Object, required: true })
  config!: Record<string, any>;
}

export type AutomationRuleDocument = AutomationRule & Document;

@Schema({ timestamps: true, collection: 'automation_rules' })
export class AutomationRule {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: true })
  isActive!: boolean;

  /** The source platform this rule listens to, e.g. 'shopify' */
  @Prop({ required: true, lowercase: true })
  triggerSource!: string;

  /** The event type this rule listens to, e.g. 'order.created' */
  @Prop({ required: true })
  triggerEventType!: string;

  /** Conditions that the event payload must match for this rule to fire */
  @Prop({ type: [Condition], default: [] })
  conditions!: Condition[];

  /** Actions to dispatch when the rule matches */
  @Prop({ type: [ActionConfig], required: true })
  actions!: ActionConfig[];
}

export const AutomationRuleSchema = SchemaFactory.createForClass(AutomationRule);

// Compound index for fast rule lookup during event processing
AutomationRuleSchema.index({
  tenantId: 1,
  isActive: 1,
  triggerSource: 1,
  triggerEventType: 1,
});
