import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tenant, TenantDocument } from './schemas/tenant.schema';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
  ) {}

  async findAll(): Promise<TenantDocument[]> {
    return this.tenantModel.find({ isActive: true }).lean().exec() as any;
  }

  async findById(id: string): Promise<TenantDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid tenant ID');
    }
    const tenant = await this.tenantModel.findById(id).lean().exec();
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }
    return tenant as any;
  }

  async findBySlug(slug: string): Promise<TenantDocument | null> {
    return this.tenantModel.findOne({ slug, isActive: true }).lean().exec() as any;
  }

  async create(data: {
    name: string;
    slug: string;
    webhookSecret: string;
  }): Promise<TenantDocument> {
    const tenant = new this.tenantModel(data);
    return tenant.save();
  }

  async exists(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    const count = await this.tenantModel.countDocuments({ _id: id, isActive: true });
    return count > 0;
  }
}
