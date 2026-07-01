import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AutomationRule,
  AutomationRuleDocument,
} from './schemas/automation-rule.schema';

/**
 * Core rule evaluation engine.
 *
 * Design decision: We support 5 solid operators rather than 10 half-baked ones.
 * The brief explicitly says: "A working engine with three operators beats a broken one with ten."
 *
 * The engine:
 * 1. Finds all active rules matching the tenant + source + eventType
 * 2. Evaluates each rule's conditions against the event payload
 * 3. Returns the list of matched rules (with their actions)
 */
@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  /**
   * Supported operators with their evaluation functions.
   * Each operator is a pure function: (fieldValue, conditionValue) => boolean
   */
  private readonly operators: Record<
    string,
    (fieldValue: any, condValue: any) => boolean
  > = {
    equals: (fieldValue, condValue) => {
      // Handle type coercion for numbers stored as strings
      if (typeof condValue === 'number') {
        return Number(fieldValue) === condValue;
      }
      return String(fieldValue) === String(condValue);
    },

    not_equals: (fieldValue, condValue) => {
      if (typeof condValue === 'number') {
        return Number(fieldValue) !== condValue;
      }
      return String(fieldValue) !== String(condValue);
    },

    greater_than: (fieldValue, condValue) => {
      return Number(fieldValue) > Number(condValue);
    },

    less_than: (fieldValue, condValue) => {
      return Number(fieldValue) < Number(condValue);
    },

    contains: (fieldValue, condValue) => {
      return String(fieldValue)
        .toLowerCase()
        .includes(String(condValue).toLowerCase());
    },

    exists: (fieldValue) => {
      return fieldValue !== undefined && fieldValue !== null;
    },
  };

  /**
   * Evaluate all active rules for a given event.
   * Returns an array of rules whose conditions all match the payload.
   */
  async evaluate(
    rules: AutomationRuleDocument[],
    payload: Record<string, any>,
  ): Promise<AutomationRuleDocument[]> {
    const matchedRules: AutomationRuleDocument[] = [];

    for (const rule of rules) {
      const isMatch = this.evaluateConditions(rule.conditions, payload);
      if (isMatch) {
        this.logger.log(`Rule matched: "${rule.name}" (${rule._id})`);
        matchedRules.push(rule);
      } else {
        this.logger.debug(`Rule did not match: "${rule.name}" (${rule._id})`);
      }
    }

    return matchedRules;
  }

  /**
   * Evaluate all conditions for a single rule.
   * ALL conditions must match (AND logic) for the rule to fire.
   * An empty conditions array matches everything (no filters = always match).
   */
  private evaluateConditions(
    conditions: Array<{ field: string; operator: string; value?: any }>,
    payload: Record<string, any>,
  ): boolean {
    // No conditions = match everything (useful for "on any order.created, do X")
    if (!conditions || conditions.length === 0) {
      return true;
    }

    return conditions.every((condition) => {
      const fieldValue = this.getNestedValue(payload, condition.field);
      const operatorFn = this.operators[condition.operator];

      if (!operatorFn) {
        this.logger.warn(`Unknown operator: ${condition.operator}`);
        return false;
      }

      try {
        return operatorFn(fieldValue, condition.value);
      } catch (error) {
        this.logger.warn(
          `Error evaluating condition: field=${condition.field}, operator=${condition.operator}, error=${error}`,
        );
        return false;
      }
    });
  }

  /**
   * Access nested object properties using dot notation.
   * Example: getNestedValue({ order: { total_price: 500 } }, 'order.total_price') => 500
   */
  private getNestedValue(
    obj: Record<string, any>,
    path: string,
  ): any {
    return path.split('.').reduce((current, key) => {
      if (current === undefined || current === null) return undefined;
      return current[key];
    }, obj as any);
  }
}
