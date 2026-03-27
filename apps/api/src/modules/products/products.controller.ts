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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('low-stock')
  @RequirePermissions('inventory.read')
  findLowStock(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.productsService.findLowStock(req.user.tenantId, {
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
    });
  }

  @Get()
  @RequirePermissions('inventory.read')
  findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('category') category?: string,
    @Query('supplierId') supplierId?: string,
    @Query('isActive') isActive?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    return this.productsService.findAll(req.user.tenantId, {
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      category,
      supplierId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      lowStock: lowStock !== undefined ? lowStock === 'true' : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('inventory.read')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.productsService.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermissions('inventory.create')
  create(@Request() req: any, @Body() dto: CreateProductDto) {
    return this.productsService.create(
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
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(
      req.user.tenantId,
      id,
      dto,
      req.user.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('inventory.delete')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.productsService.remove(
      req.user.tenantId,
      id,
      req.user.userId,
    );
  }
}
