import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ServiceBundlesService } from './service-bundles.service';
import { CreateServiceBundleDto } from './dto/create-service-bundle.dto';
import { UpdateServiceBundleDto } from './dto/update-service-bundle.dto';

@Controller('service-bundles')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ServiceBundlesController {
  constructor(private readonly serviceBundlesService: ServiceBundlesService) {}

  @Get()
  @RequirePermissions('services.read')
  findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.serviceBundlesService.findAll(req.user.tenantId, {
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('services.read')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.serviceBundlesService.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermissions('services.create')
  create(@Request() req: any, @Body() dto: CreateServiceBundleDto) {
    return this.serviceBundlesService.create(
      req.user.tenantId,
      dto,
      req.user.userId,
    );
  }

  @Put(':id')
  @RequirePermissions('services.update')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateServiceBundleDto,
  ) {
    return this.serviceBundlesService.update(
      req.user.tenantId,
      id,
      dto,
      req.user.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('services.delete')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.serviceBundlesService.remove(
      req.user.tenantId,
      id,
      req.user.userId,
    );
  }
}
