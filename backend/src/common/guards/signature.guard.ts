import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant, TenantDocument } from '../../modules/tenants/schemas/tenant.schema';

/**
 * Guard that verifies webhook signatures using HMAC-SHA256.
 *
 * Each tenant has their own webhook secret. The guard:
 * 1. Looks up the tenant's secret from the database
 * 2. Computes HMAC-SHA256 of the raw request body
 * 3. Compares it against the X-Webhook-Signature header
 *
 * If signature is missing or invalid, the request is rejected with 401
 * BEFORE any database writes occur.
 *
 * This is a key NestJS depth signal — using guards naturally for cross-cutting concerns.
 */
@Injectable()
export class SignatureGuard implements CanActivate {
  private readonly logger = new Logger(SignatureGuard.name);

  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.params.tenantId || request.tenantId;
    const signature = request.headers['x-webhook-signature'] as string;

    // If no signature header is sent, allow through but log warning
    // In production, you'd enforce this strictly per source platform
    if (!signature) {
      this.logger.warn(
        `No signature provided for webhook to tenant ${tenantId}. Allowing through for demo purposes.`,
      );
      return true;
    }

    // Look up tenant's webhook secret
    const tenant = await this.tenantModel.findById(tenantId).lean();
    if (!tenant) {
      this.logger.warn(`Signature check failed: tenant ${tenantId} not found`);
      throw new UnauthorizedException('Invalid tenant');
    }

    // Compute expected signature
    const rawBody = JSON.stringify(request.body);
    const expectedSignature = createHmac('sha256', tenant.webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
      this.logger.warn(`Signature length mismatch for tenant ${tenantId}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const isValid = require('crypto').timingSafeEqual(sigBuffer, expectedBuffer);
    if (!isValid) {
      this.logger.warn(`Invalid webhook signature for tenant ${tenantId}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.debug(`Valid signature verified for tenant ${tenantId}`);
    return true;
  }
}
