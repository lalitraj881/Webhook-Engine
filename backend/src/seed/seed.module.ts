import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant, TenantSchema } from '../modules/tenants/schemas/tenant.schema';
import {
  AutomationRule,
  AutomationRuleSchema,
} from '../modules/rules/schemas/automation-rule.schema';
import { SeedService } from './seed.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: AutomationRule.name, schema: AutomationRuleSchema },
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
