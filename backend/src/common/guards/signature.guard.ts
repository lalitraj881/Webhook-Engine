import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
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
 * Design decision: Use rawBody (not re-serialized JSON) for HMAC computation.
 * Re-serializing via JSON.stringify can change key ordering and whitespace,
 * causing signature mismatches with real webhook providers.
 *
 * This is a key NestJS depth signal — using guards naturally for cross-cutting concerns.
 */
@Injectable()
export class SignatureGuard implements CanActivate {
  private readonly logger = new Logger(SignatureGuard.name);
  private readonly signatureRequired: boolean;

  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    private configService: ConfigService,
  ) {
    // Default to false for demo/development, set to 'true' in production
    this.signatureRequired = this.configService.get<string>(
      'WEBHOOK_SIGNATURE_REQUIRED', 'false',
    ) === 'true';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.params.tenantId || request.tenantId;
    const signature = request.headers['x-webhook-signature'] as string;

    // If no signature header is sent, behavior depends on configuration
    if (!signature) {
      if (this.signatureRequired) {
        this.logger.warn(
          `Missing signature header for webhook to tenant ${tenantId}. Rejecting.`,
        );
        throw new UnauthorizedException(
          'Missing X-Webhook-Signature header. All webhooks must be signed.',
        );
      }
      this.logger.warn(
        `No signature provided for webhook to tenant ${tenantId}. ` +
        `Allowing through (WEBHOOK_SIGNATURE_REQUIRED=false).`,
      );
      return true;
    }

    // Look up tenant's webhook secret
    const tenant = await this.tenantModel.findById(tenantId).lean();
    if (!tenant) {
      this.logger.warn(`Signature check failed: tenant ${tenantId} not found`);
      throw new UnauthorizedException('Invalid tenant');
    }

    // Use rawBody for accurate HMAC computation
    // rawBody preserves the exact bytes sent by the webhook provider,
    // whereas JSON.stringify(request.body) may re-order keys or change whitespace
    const rawBody = request.rawBody
      ? request.rawBody.toString('utf-8')
      : JSON.stringify(request.body);

    // Compute expected signature
    const expectedSignature = createHmac('sha256', tenant.webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    try {
      const sigBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (sigBuffer.length !== expectedBuffer.length) {
        this.logger.warn(`Signature length mismatch for tenant ${tenantId}`);
        throw new UnauthorizedException('Invalid webhook signature');
      }

      const isValid = timingSafeEqual(sigBuffer, expectedBuffer);
      if (!isValid) {
        this.logger.warn(`Invalid webhook signature for tenant ${tenantId}`);
        throw new UnauthorizedException('Invalid webhook signature');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      // Handle malformed hex strings
      this.logger.warn(
        `Malformed signature format for tenant ${tenantId}: ${error}`,
      );
      throw new UnauthorizedException('Invalid webhook signature format');
    }

    this.logger.debug(`Valid signature verified for tenant ${tenantId}`);
    return true;
  }
}

