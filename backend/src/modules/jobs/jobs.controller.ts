import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';

/**
 * Job history API controller.
 * TenantGuard validates the tenant exists and is active — server-side enforcement.
 */
@Controller('api/jobs')
@UseGuards(TenantGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /** List all jobs for the current tenant (paginated, filterable) */
  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.jobsService.findByTenant(tenantId, {
      status,
      page: page || 1,
      limit: limit || 50,
    });
  }

  /** Get dashboard stats for the current tenant */
  @Get('stats')
  async getStats(@CurrentTenant() tenantId: string) {
    const stats = await this.jobsService.getStats(tenantId);
    return { data: stats };
  }

  /** Get details of a single job including all attempts */
  @Get(':jobId')
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    const job = await this.jobsService.findOne(tenantId, jobId);
    return { data: job };
  }

  /**
   * Replay a failed job.
   * Creates a new job entry and re-enqueues it to the action-dispatch queue.
   */
  @Post(':jobId/replay')
  async replay(
    @CurrentTenant() tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    const replayJob = await this.jobsService.replayJob(tenantId, jobId);
    return {
      data: replayJob,
      message: 'Job has been replayed and queued for processing',
    };
  }
}
