import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsBoolean,
  IsIn,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Condition DTO — validates the structure of each condition in a rule.
 *
 * Example: { field: 'order.total_price', operator: 'greater_than', value: 500 }
 */
export class ConditionDto {
  @IsString()
  @IsNotEmpty()
  field!: string;

  @IsString()
  @IsIn(['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'exists'])
  operator!: string;

  @IsOptional()
  value?: any;
}

/**
 * Action DTO — validates the structure of each action in a rule.
 *
 * Example: { type: 'webhook', config: { url: 'https://...' } }
 */
export class ActionDto {
  @IsString()
  @IsIn(['webhook', 'email', 'log'])
  type!: string;

  @IsNotEmpty()
  config!: Record<string, any>;
}

/**
 * DTO for creating a new automation rule.
 *
 * Validates:
 * - name is required and non-empty
 * - triggerSource and triggerEventType are required
 * - conditions are optional but validated when present
 * - actions are required with at least one action
 *
 * Shows NestJS depth: DTOs with class-validator decorators for input validation.
 */
export class CreateRuleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  triggerSource!: string;

  @IsString()
  @IsNotEmpty()
  triggerEventType!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one action is required' })
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions!: ActionDto[];
}

/**
 * DTO for updating an existing automation rule.
 * All fields are optional — only provided fields are updated.
 */
export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  conditions?: ConditionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions?: ActionDto[];
}
