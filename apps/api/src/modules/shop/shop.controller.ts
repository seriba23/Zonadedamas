import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ShopService } from './shop.service';
import { CreateReservationDto, CreateBatchReservationDto } from './dto/create-reservation.dto';
import { MarketplaceJwtOptionalGuard } from '../marketplace/guards/marketplace-jwt-optional.guard';
import { UploadsService } from '../uploads/uploads.service';

@Controller('public/:tenantSlug/shop')
export class ShopController {
  constructor(
    private readonly shopService: ShopService,
    private readonly uploadsService: UploadsService,
  ) {}

  @Get('settings')
  getSettings(@Param('tenantSlug') tenantSlug: string) {
    return this.shopService.getShopSettings(tenantSlug);
  }

  @Get('products')
  getProducts(
    @Param('tenantSlug') tenantSlug: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('category') category?: string,
  ) {
    return this.shopService.getProducts(tenantSlug, {
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      category,
    });
  }

  @Get('products/:id')
  getProductDetail(
    @Param('tenantSlug') tenantSlug: string,
    @Param('id') id: string,
  ) {
    return this.shopService.getProductDetail(tenantSlug, id);
  }

  @Post('reserve')
  @UseGuards(MarketplaceJwtOptionalGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  createReservation(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateReservationDto,
    @Req() req: any,
  ) {
    return this.shopService.createReservation(tenantSlug, dto, req.user?.marketplaceUserId);
  }

  @Post('reserve-batch')
  @UseGuards(MarketplaceJwtOptionalGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  createBatchReservation(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateBatchReservationDto,
    @Req() req: any,
  ) {
    return this.shopService.createBatchReservation(tenantSlug, dto, req.user?.marketplaceUserId);
  }

  // Cliente sube captura de pantalla del comprobante de transferencia.
  // Devuelve la URL para que el cliente la incluya en el body del reserve.
  @Post('upload-payment-proof')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadPaymentProof(@UploadedFile() file: any) {
    const imageUrl = await this.uploadsService.saveFile(file, 'payments');
    return { data: { paymentProofUrl: imageUrl } };
  }
}
