import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TenantDocument = Tenant & Document;

@Schema({ timestamps: true, collection: 'tenants' })
export class Tenant {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug!: string;

  /**
   * Secret used for HMAC-SHA256 webhook signature verification.
   * Each tenant has their own secret so spoofed webhooks are rejected per-tenant.
   */
  @Prop({ required: true })
  webhookSecret!: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);

// Indexes
TenantSchema.index({ slug: 1 }, { unique: true });
TenantSchema.index({ isActive: 1 });
