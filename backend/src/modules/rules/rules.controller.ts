import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { RulesService } from './rules.service';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';

@Controller('api/rules')
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
    @Body()
    body: {
      name: string;
      triggerSource: string;
      triggerEventType: string;
      conditions: Array<{ field: string; operator: string; value?: any }>;
      actions: Array<{ type: string; config: Record<string, any> }>;
    },
  ) {
    const rule = await this.rulesService.create(tenantId, body);
    return { data: rule };
  }

  @Put(':ruleId')
  async update(
    @CurrentTenant() tenantId: string,
    @Param('ruleId') ruleId: string,
    @Body() body: any,
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
