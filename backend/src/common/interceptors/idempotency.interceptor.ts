import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Interceptor that implements exactly-once delivery semantics using Redis SETNX.
 *
 * Design decision: We use Redis for the hot-path dedup check because:
 * - SETNX is atomic (no race conditions between concurrent webhook deliveries)
 * - Redis is already in the stack for BullMQ
 * - Sub-millisecond latency keeps our response time under 200ms
 * - 24h TTL prevents unbounded memory growth
 *
 * MongoDB's unique index on idempotencyKey serves as a secondary safety net
 * in case Redis restarts and loses dedup state.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD', ''),
    });
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const tenantId = request.params.tenantId || request.tenantId;
    const source = request.params.source;
    const body = request.body;

    // Extract event ID from payload or headers
    // Platforms typically send a unique event identifier
    const eventId =
      body.eventId ||
      body.id ||
      request.headers['x-webhook-id'] ||
      request.headers['x-shopify-webhook-id'] ||
      this.generateFallbackId(body);

    const idempotencyKey = `idemp:${tenantId}:${source}:${eventId}`;

    // Atomic check-and-set with 24h TTL
    const isNew = await this.redis.set(idempotencyKey, '1', 'EX', 86400, 'NX');

    if (!isNew) {
      this.logger.log(
        `Duplicate webhook detected: ${idempotencyKey}. Acknowledging without processing.`,
      );
      // Return 200 (acknowledge) but skip processing
      // This is critical: platforms expect 200 to stop retrying
      response.status(HttpStatus.OK);
      return of({
        status: 'duplicate',
        message: 'Event already received and is being processed',
        idempotencyKey,
      });
    }

    // Attach the idempotency key and event ID to the request for downstream use
    request.idempotencyKey = idempotencyKey;
    request.eventId = eventId;

    return next.handle();
  }

  /**
   * Fallback: generate a deterministic hash of the payload if no event ID is provided.
   * This handles cases where the external platform doesn't send an explicit event ID.
   */
  private generateFallbackId(body: Record<string, any>): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex')
      .substring(0, 16);
  }
}
