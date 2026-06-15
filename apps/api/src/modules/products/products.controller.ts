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
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Get('reservations')
  @RequirePermissions('inventory.read')
  findAllReservations(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('status') status?: string,
  ) {
    return this.productsService.findAllReservations(req.user.tenantId, {
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      status,
    });
  }

  @Get('sales-stats')
  @RequirePermissions('inventory.read')
  async salesStats(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.productsService.getSalesStats(req.user.tenantId, { startDate, endDate });
  }

  /**
   * Apartados cobrables desde el POS: status no terminal + (sin cita o
   * cita CANCELLED). Los apartados de citas activas se cobran al cobrar
   * la cita, asi que no se listan aqui para evitar doble cobro.
   */
  @Get('reservations/payable')
  @RequirePermissions('payments.create')
  findPayableReservations(@Request() req: any) {
    return this.productsService.findPayableReservations(req.user.tenantId);
  }

  @Put('reservations/:id/status')
  @RequirePermissions('inventory.update')
  updateReservationStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.productsService.updateReservationStatus(
      req.user.tenantId,
      id,
      status,
      req.user.userId,
    );
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

  // ─── Image Management ────────────────────────────

  @Post(':id/image')
  @RequirePermissions('inventory.update')
  @UseInterceptors(FileInterceptor('file'))
  uploadMainImage(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    return this.productsService.uploadMainImage(
      req.user.tenantId,
      id,
      file,
      req.user.userId,
    );
  }

  @Post(':id/gallery')
  @RequirePermissions('inventory.update')
  @UseInterceptors(FileInterceptor('file'))
  addGalleryImage(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    return this.productsService.addGalleryImage(
      req.user.tenantId,
      id,
      file,
      req.user.userId,
    );
  }

  @Delete(':id/gallery/:imageId')
  @RequirePermissions('inventory.update')
  removeGalleryImage(
    @Request() req: any,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.productsService.removeGalleryImage(
      req.user.tenantId,
      id,
      imageId,
    );
  }
}
