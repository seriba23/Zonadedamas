import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResourcesService } from './resources.service';
import { CreateResourceDto, UpdateResourceDto } from './dto/create-resource.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UploadsService } from '../uploads/uploads.service';

@Controller('resources')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ResourcesController {
  constructor(
    private readonly resourcesService: ResourcesService,
    private readonly uploadsService: UploadsService,
  ) {}

  @Get()
  @RequirePermissions('resources.read')
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() pagination: PaginationDto,
    @Query('assignedTo') assignedTo?: string,
  ) {
    return this.resourcesService.findAll(tenantId, pagination, assignedTo);
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

  @Post(':id/image/:slot')
  @RequirePermissions('resources.update')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('id') id: string,
    @Param('slot') slot: string,
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: any,
  ) {
    const resource = await this.resourcesService.findOne(id, tenantId) as any;
    const fieldMap: Record<string, string> = { '1': 'imageUrl', '2': 'imageUrl2', '3': 'imageUrl3' };
    const field = fieldMap[slot] || 'imageUrl';

    if (resource[field]) {
      await this.uploadsService.deleteFile(resource[field]);
    }
    const url = await this.uploadsService.saveFile(file, 'resources');
    const updated = await this.resourcesService.update(id, tenantId, { [field]: url });
    return { data: updated };
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
