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
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto/create-client.dto';
import { SearchClientsDto, CreateClientTagDto } from './dto/search-clients.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { IsString } from 'class-validator';

class AddTagDto {
  @IsString()
  tagId: string;
}

@Controller('clients')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequirePermissions('clients.read')
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: SearchClientsDto,
  ) {
    return this.clientsService.findAll(tenantId, query);
  }

  @Post()
  @RequirePermissions('clients.create')
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateClientDto,
  ) {
    const client = await this.clientsService.create(tenantId, dto);
    return { data: client };
  }

  @Get('tags')
  @RequirePermissions('clients.read')
  async findAllTags(@CurrentTenant() tenantId: string) {
    const tags = await this.clientsService.findAllTags(tenantId);
    return { data: tags };
  }

  @Post('tags')
  @RequirePermissions('clients.update')
  async createTag(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateClientTagDto,
  ) {
    const tag = await this.clientsService.createTag(tenantId, dto);
    return { data: tag };
  }

  @Get(':id')
  @RequirePermissions('clients.read')
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const client = await this.clientsService.findOne(id, tenantId);
    return { data: client };
  }

  @Put(':id')
  @RequirePermissions('clients.update')
  async update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateClientDto,
  ) {
    const client = await this.clientsService.update(id, tenantId, dto);
    return { data: client };
  }

  @Delete(':id')
  @RequirePermissions('clients.delete')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.clientsService.remove(id, tenantId);
    return { data: result };
  }

  @Post(':id/tags')
  @RequirePermissions('clients.update')
  async addTag(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: AddTagDto,
  ) {
    const result = await this.clientsService.addTag(id, tenantId, dto.tagId);
    return { data: result };
  }

  @Delete(':id/tags/:tagId')
  @RequirePermissions('clients.update')
  async removeTag(
    @Param('id') id: string,
    @Param('tagId') tagId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.clientsService.removeTag(id, tenantId, tagId);
    return { data: result };
  }
}
