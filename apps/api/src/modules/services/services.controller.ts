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
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('services')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @RequirePermissions('services.read')
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.servicesService.findAll(tenantId, pagination);
  }

  @Post()
  @RequirePermissions('services.create')
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateServiceDto,
  ) {
    const service = await this.servicesService.create(tenantId, dto);
    return { data: service };
  }

  @Get(':id')
  @RequirePermissions('services.read')
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const service = await this.servicesService.findOne(id, tenantId);
    return { data: service };
  }

  @Put(':id')
  @RequirePermissions('services.update')
  async update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateServiceDto,
  ) {
    const service = await this.servicesService.update(id, tenantId, dto);
    return { data: service };
  }

  @Delete(':id')
  @RequirePermissions('services.delete')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.servicesService.remove(id, tenantId);
    return { data: result };
  }
}
