import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AutomationRule,
  AutomationRuleDocument,
} from './schemas/automation-rule.schema';

@Injectable()
export class RulesService {
  private readonly logger = new Logger(RulesService.name);

  constructor(
    @InjectModel(AutomationRule.name)
    private ruleModel: Model<AutomationRuleDocument>,
  ) {}

  /** Find all active rules that match the given source and event type for a tenant */
  async findMatchingRules(
    tenantId: string,
    source: string,
    eventType: string,
  ): Promise<AutomationRuleDocument[]> {
    return this.ruleModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        isActive: true,
        triggerSource: source.toLowerCase(),
        triggerEventType: eventType,
      })
      .lean()
      .exec() as any;
  }

  /** List all rules for a tenant */
  async findByTenant(tenantId: string): Promise<AutomationRuleDocument[]> {
    return this.ruleModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec() as any;
  }

  /** Create a new automation rule */
  async create(
    tenantId: string,
    data: {
      name: string;
      triggerSource: string;
      triggerEventType: string;
      conditions: Array<{ field: string; operator: string; value?: any }>;
      actions: Array<{ type: string; config: Record<string, any> }>;
    },
  ): Promise<AutomationRuleDocument> {
    const rule = new this.ruleModel({
      tenantId: new Types.ObjectId(tenantId),
      ...data,
    });
    return rule.save();
  }

  /** Update a rule — tenant-scoped */
  async update(
    tenantId: string,
    ruleId: string,
    data: Partial<{
      name: string;
      isActive: boolean;
      conditions: Array<{ field: string; operator: string; value?: any }>;
      actions: Array<{ type: string; config: Record<string, any> }>;
    }>,
  ): Promise<AutomationRuleDocument> {
    const rule = await this.ruleModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(ruleId),
          tenantId: new Types.ObjectId(tenantId), // Tenant isolation enforced
        },
        { $set: data },
        { new: true },
      )
      .lean()
      .exec();

    if (!rule) {
      throw new NotFoundException('Rule not found');
    }
    return rule as any;
  }

  /** Delete a rule — tenant-scoped */
  async delete(tenantId: string, ruleId: string): Promise<void> {
    const result = await this.ruleModel.deleteOne({
      _id: new Types.ObjectId(ruleId),
      tenantId: new Types.ObjectId(tenantId),
    });
    if (result.deletedCount === 0) {
      throw new NotFoundException('Rule not found');
    }
  }
}
