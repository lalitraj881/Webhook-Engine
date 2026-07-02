import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';

/**
 * DTO for incoming webhook payloads.
 *
 * This is intentionally permissive — external platforms send widely varying
 * payload structures. We validate only the minimum required fields and allow
 * the rest through (no whitelist/forbidNonWhitelisted for this specific endpoint).
 *
 * The eventType is required because without it, the rule engine cannot match
 * any rules. The id is optional because some platforms send it in headers instead.
 */
export class IncomingWebhookDto {
  /**
   * Event type, e.g. 'order.created', 'payment.failed'.
   * Platforms may send this as 'eventType', 'event_type', or 'type'.
   * If not in the body, it can come from headers (x-event-type, x-shopify-topic).
   */
  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  event_type?: string;

  @IsOptional()
  @IsString()
  type?: string;

  /**
   * Event ID for idempotency.
   * If not present, the IdempotencyInterceptor generates a fallback hash.
   */
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  eventId?: string;
}
