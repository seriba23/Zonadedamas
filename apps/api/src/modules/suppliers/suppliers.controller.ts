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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @RequirePermissions('inventory.read')
  findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.suppliersService.findAll(req.user.tenantId, {
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('inventory.read')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.suppliersService.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermissions('inventory.create')
  create(@Request() req: any, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(
      req.user.tenantId,
      dto,
      req.user.userId,
    );
  }

  @Put(':id')
  @RequirePermissions('inventory.update')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(
      req.user.tenantId,
      id,
      dto,
      req.user.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('inventory.delete')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.suppliersService.remove(
      req.user.tenantId,
      id,
      req.user.userId,
    );
  }
}
