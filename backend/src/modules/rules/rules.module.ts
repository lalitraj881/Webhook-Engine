import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AutomationRule,
  AutomationRuleSchema,
} from './schemas/automation-rule.schema';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { RuleEngineService } from './rule-engine.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AutomationRule.name, schema: AutomationRuleSchema },
    ]),
  ],
  controllers: [RulesController],
  providers: [RulesService, RuleEngineService],
  exports: [RulesService, RuleEngineService, MongooseModule],
})
export class RulesModule {}
