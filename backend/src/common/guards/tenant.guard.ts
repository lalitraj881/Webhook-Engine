import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tenant, TenantDocument } from '../../modules/tenants/schemas/tenant.schema';

/**
 * Guard that validates the tenantId exists and is active.
 * Applied to API routes to ensure the requesting tenant is valid.
 *
 * This is server-side tenant enforcement — not just UI filtering.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId || request.params.tenantId;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant identification required');
    }

    // Validate that tenantId is a valid ObjectId format
    if (!Types.ObjectId.isValid(tenantId)) {
      throw new UnauthorizedException('Invalid tenant identifier format');
    }

    // Check if tenant exists and is active
    const tenant = await this.tenantModel
      .findOne({ _id: tenantId, isActive: true })
      .lean();

    if (!tenant) {
      this.logger.warn(`Access attempt with invalid/inactive tenant: ${tenantId}`);
      throw new UnauthorizedException('Tenant not found or inactive');
    }

    // Attach full tenant info to request for downstream use
    request.tenant = tenant;
    return true;
  }
}
