import { Controller, Get, Param, Query } from '@nestjs/common';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

/**
 * Events API controller — provides tenant-scoped read access to webhook events.
 * Separate from the webhook ingestion controller because:
 * 1. Different auth mechanism (header-based tenant ID vs URL param)
 * 2. Different guards (no signature guard needed for reads)
 */
@Controller('api/events')
export class EventsController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  async listEvents(
    @CurrentTenant() tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.webhooksService.findByTenant(tenantId, page || 1, limit || 50);
  }

  @Get(':eventId')
  async getEvent(
    @CurrentTenant() tenantId: string,
    @Param('eventId') eventId: string,
  ) {
    const event = await this.webhooksService.findOne(tenantId, eventId);
    return { data: event };
  }
}
