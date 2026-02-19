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
import { ResourcesService } from './resources.service';
import { CreateResourceDto, UpdateResourceDto } from './dto/create-resource.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('resources')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  @RequirePermissions('resources.read')
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.resourcesService.findAll(tenantId, pagination);
  }

  @Post()
  @RequirePermissions('resources.create')
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateResourceDto,
  ) {
    const resource = await this.resourcesService.create(tenantId, dto);
    return { data: resource };
  }

  @Get(':id')
  @RequirePermissions('resources.read')
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const resource = await this.resourcesService.findOne(id, tenantId);
    return { data: resource };
  }

  @Put(':id')
  @RequirePermissions('resources.update')
  async update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateResourceDto,
  ) {
    const resource = await this.resourcesService.update(id, tenantId, dto);
    return { data: resource };
  }

  @Delete(':id')
  @RequirePermissions('resources.delete')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.resourcesService.remove(id, tenantId);
    return { data: result };
  }
}
