import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RulesService } from './rules.service';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateRuleDto, UpdateRuleDto } from './dto/create-rule.dto';

/**
 * Automation rules API controller.
 * TenantGuard validates the tenant exists and is active — server-side enforcement.
 */
@Controller('api/rules')
@UseGuards(TenantGuard)
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  async findAll(@CurrentTenant() tenantId: string) {
    const rules = await this.rulesService.findByTenant(tenantId);
    return { data: rules };
  }

  @Post()
  async create(
    @CurrentTenant() tenantId: string,
    @Body() body: CreateRuleDto,
  ) {
    const rule = await this.rulesService.create(tenantId, body);
    return { data: rule };
  }

  @Put(':ruleId')
  async update(
    @CurrentTenant() tenantId: string,
    @Param('ruleId') ruleId: string,
    @Body() body: UpdateRuleDto,
  ) {
    const rule = await this.rulesService.update(tenantId, ruleId, body);
    return { data: rule };
  }

  @Delete(':ruleId')
  async delete(
    @CurrentTenant() tenantId: string,
    @Param('ruleId') ruleId: string,
  ) {
    await this.rulesService.delete(tenantId, ruleId);
    return { message: 'Rule deleted' };
  }
}
