import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateLocationDto, UpdateLocationDto } from './dto/create-location.dto';
import { SetBusinessHoursDto } from './dto/business-hours.dto';
import { CreateBusinessClosureDto, ClosureQueryDto } from './dto/business-closure.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@Controller()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Public()
  @Post('tenants')
  async onboard(@Body() dto: CreateTenantDto) {
    const result = await this.tenantsService.onboard(dto);
    return { data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Get('tenants/current')
  async getCurrent(@CurrentTenant() tenantId: string) {
    const tenant = await this.tenantsService.getCurrent(tenantId);
    return { data: tenant };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('locations.create')
  @Post('locations')
  async createLocation(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateLocationDto,
  ) {
    const location = await this.tenantsService.createLocation(tenantId, dto);
    return { data: location };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('locations.read')
  @Get('locations')
  async findAllLocations(@CurrentTenant() tenantId: string) {
    const locations = await this.tenantsService.findAllLocations(tenantId);
    return { data: locations };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('locations.update')
  @Put('locations/:id')
  async updateLocation(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    const location = await this.tenantsService.updateLocation(id, tenantId, dto);
    return { data: location };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('locations.delete')
  @Delete('locations/:id')
  async deleteLocation(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.tenantsService.deleteLocation(id, tenantId);
    return { data: result };
  }

  // Business Hours
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.read')
  @Get('tenant/business-hours')
  async getBusinessHours(@CurrentTenant() tenantId: string) {
    const hours = await this.tenantsService.getBusinessHours(tenantId);
    return { data: hours };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Put('tenant/business-hours')
  async setBusinessHours(
    @CurrentTenant() tenantId: string,
    @Body() dto: SetBusinessHoursDto,
  ) {
    const hours = await this.tenantsService.setBusinessHours(tenantId, dto);
    return { data: hours };
  }

  // Business Closures
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.read')
  @Get('tenant/closures')
  async getClosures(
    @CurrentTenant() tenantId: string,
    @Query() query: ClosureQueryDto,
  ) {
    const closures = await this.tenantsService.getClosures(
      tenantId,
      query.startDate,
      query.endDate,
    );
    return { data: closures };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Post('tenant/closures')
  async createClosure(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateBusinessClosureDto,
  ) {
    const closure = await this.tenantsService.createClosure(tenantId, dto);
    return { data: closure };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Delete('tenant/closures/:id')
  async deleteClosure(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.tenantsService.deleteClosure(id, tenantId);
    return { data: result };
  }
}
