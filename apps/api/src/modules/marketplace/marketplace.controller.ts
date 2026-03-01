import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceRegisterDto } from './dto/marketplace-register.dto';
import { MarketplaceLoginDto } from './dto/marketplace-login.dto';
import { MarketplaceDiscoverDto } from './dto/marketplace-discover.dto';
import { MarketplaceJwtGuard } from './guards/marketplace-jwt.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  // ─── AUTH (public) ───────────────────────────────────

  @Post('auth/register')
  async register(@Body() dto: MarketplaceRegisterDto) {
    const result = await this.marketplaceService.register(dto);
    return { data: result };
  }

  @Post('auth/login')
  async login(@Body() dto: MarketplaceLoginDto) {
    const result = await this.marketplaceService.login(dto);
    return { data: result };
  }

  @Post('auth/refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    const result = await this.marketplaceService.refresh(refreshToken);
    return { data: result };
  }

  @Post('auth/logout')
  async logout(@Body('refreshToken') refreshToken: string) {
    await this.marketplaceService.logout(refreshToken);
    return { data: { message: 'Sesión cerrada' } };
  }

  @UseGuards(MarketplaceJwtGuard)
  @Get('auth/me')
  async getMe(@Req() req: any) {
    const user = await this.marketplaceService.getMe(req.user.marketplaceUserId);
    return { data: user };
  }

  // ─── DISCOVERY (public) ──────────────────────────────

  @Get('discover')
  async discover(@Query() dto: MarketplaceDiscoverDto) {
    return this.marketplaceService.discover(dto);
  }

  @Get('discover/:tenantSlug')
  async getBusinessDetail(@Param('tenantSlug') tenantSlug: string) {
    return this.marketplaceService.getBusinessDetail(tenantSlug);
  }

  // ─── ENTER BUSINESS (auth required) ──────────────────

  @UseGuards(MarketplaceJwtGuard)
  @Post('enter/:tenantSlug')
  async enterBusiness(
    @Req() req: any,
    @Param('tenantSlug') tenantSlug: string,
  ) {
    const result = await this.marketplaceService.enterBusiness(
      req.user.marketplaceUserId,
      tenantSlug,
    );
    return { data: result };
  }

  // ─── QR (staff auth) ────────────────────────────────

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.read')
  @Get('qr')
  async getQrData(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.marketplaceService.getQrData(tenantId, locationId);
  }
}
