import { Controller, Get, Param } from '@nestjs/common';
import { TenantsService } from './tenants.service';

@Controller('api/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /** List all active tenants — used by the frontend tenant selector */
  @Get()
  async findAll() {
    const tenants = await this.tenantsService.findAll();
    return { data: tenants };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const tenant = await this.tenantsService.findById(id);
    return { data: tenant };
  }
}
