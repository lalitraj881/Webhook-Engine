import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  UseGuards,
  UseInterceptors,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { SignatureGuard } from '../../common/guards/signature.guard';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

/**
 * Webhook ingestion controller.
 *
 * Endpoint: POST /webhooks/:tenantId/:source
 *
 * Guard chain (all run BEFORE database writes):
 * 1. SignatureGuard → HMAC verification
 * 2. IdempotencyInterceptor → Redis SETNX dedup
 * 3. ValidationPipe (global) → payload structure check
 *
 * If any guard fails, we reject immediately and never touch MongoDB.
 *
 * Note: Read operations (listing events) are handled by EventsController
 * at /api/events, which has proper tenant middleware applied.
 */
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * Primary webhook ingestion endpoint.
   * Designed for fast acknowledgement — all heavy processing happens async via BullMQ.
   */
  @Post(':tenantId/:source')
  @UseGuards(SignatureGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(
    @Param('tenantId') tenantId: string,
    @Param('source') source: string,
    @Body() body: Record<string, any>,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ) {
    const startTime = Date.now();

    // Extract eventType from body — platforms send it differently
    const eventType =
      body.eventType ||
      body.event_type ||
      body.type ||
      headers['x-event-type'] ||
      headers['x-shopify-topic'] ||
      'unknown';

    const event = await this.webhooksService.ingest({
      tenantId,
      source,
      eventType,
      payload: body,
      headers: this.sanitizeHeaders(headers),
      idempotencyKey: req.idempotencyKey,
    });

    const processingTime = Date.now() - startTime;
    this.logger.log(
      `Webhook acknowledged in ${processingTime}ms: tenant=${tenantId}, source=${source}, type=${eventType}`,
    );

    return {
      status: 'accepted',
      eventId: event._id,
      message: 'Webhook received and queued for processing',
      processingTimeMs: processingTime,
    };
  }

  /** Remove sensitive headers before storing */
  private sanitizeHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    const safe: Record<string, string> = {};
    const allowList = [
      'content-type',
      'x-webhook-id',
      'x-webhook-signature',
      'x-shopify-topic',
      'x-shopify-webhook-id',
      'x-event-type',
      'user-agent',
    ];
    for (const key of allowList) {
      if (headers[key]) {
        safe[key] = headers[key];
      }
    }
    return safe;
  }
}

