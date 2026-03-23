import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceRegisterDto } from './dto/marketplace-register.dto';
import { MarketplaceLoginDto } from './dto/marketplace-login.dto';
import { MarketplaceDiscoverDto } from './dto/marketplace-discover.dto';
import { UpdateMarketplaceProfileDto, UpdateMarketplaceSettingsDto } from './dto/update-marketplace-profile.dto';
import { ChangeMarketplacePasswordDto } from './dto/change-marketplace-password.dto';
import { ChangeMarketplaceContactDto } from './dto/change-marketplace-contact.dto';
import { MarketplaceBookDto } from './dto/marketplace-book.dto';
import { MarketplaceSocialLoginDto } from './dto/marketplace-social-login.dto';
import { CreateCheckoutDto } from '../stripe/dto/create-checkout.dto';
import { StripeService } from '../stripe/stripe.service';
import { MarketplaceJwtGuard } from './guards/marketplace-jwt.guard';
import { MarketplaceJwtOptionalGuard } from './guards/marketplace-jwt-optional.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { UploadsService } from '../uploads/uploads.service';

@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly uploadsService: UploadsService,
    private readonly stripeService: StripeService,
  ) {}

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

  @Post('auth/social')
  async socialLogin(@Body() dto: MarketplaceSocialLoginDto) {
    const result = await this.marketplaceService.socialLogin(dto);
    return { data: result };
  }

  @UseGuards(MarketplaceJwtGuard)
  @Get('auth/me')
  async getMe(@Req() req: any) {
    const user = await this.marketplaceService.getMe(req.user.marketplaceUserId);
    return { data: user };
  }

  @UseGuards(MarketplaceJwtGuard)
  @Put('auth/profile')
  async updateProfile(@Req() req: any, @Body() dto: UpdateMarketplaceProfileDto) {
    const user = await this.marketplaceService.updateProfile(req.user.marketplaceUserId, dto);
    return { data: user };
  }

  @UseGuards(MarketplaceJwtGuard)
  @Put('auth/profile/password')
  async changePassword(@Req() req: any, @Body() dto: ChangeMarketplacePasswordDto) {
    const result = await this.marketplaceService.changePassword(req.user.marketplaceUserId, dto);
    return { data: result };
  }

  @UseGuards(MarketplaceJwtGuard)
  @Put('auth/profile/contact')
  async updateContact(@Req() req: any, @Body() dto: ChangeMarketplaceContactDto) {
    const user = await this.marketplaceService.updateContact(req.user.marketplaceUserId, dto);
    return { data: user };
  }

  @UseGuards(MarketplaceJwtGuard)
  @Put('auth/settings')
  async updateSettings(@Req() req: any, @Body() dto: UpdateMarketplaceSettingsDto) {
    const settings = await this.marketplaceService.updateSettings(req.user.marketplaceUserId, dto);
    return { data: settings };
  }

  @UseGuards(MarketplaceJwtGuard)
  @Post('auth/suspend')
  async suspendAccount(@Req() req: any, @Body() body: { days: number }) {
    const result = await this.marketplaceService.suspendAccount(req.user.marketplaceUserId, body.days);
    return { data: result };
  }

  @UseGuards(MarketplaceJwtGuard)
  @Post('auth/reactivate')
  async reactivateAccount(@Req() req: any) {
    const result = await this.marketplaceService.reactivateAccount(req.user.marketplaceUserId);
    return { data: result };
  }

  @UseGuards(MarketplaceJwtGuard)
  @Delete('auth/account')
  async deleteAccount(@Req() req: any, @Body('password') password: string) {
    await this.marketplaceService.deleteAccount(req.user.marketplaceUserId, password);
    return { data: { message: 'Cuenta eliminada correctamente' } };
  }

  @UseGuards(MarketplaceJwtGuard)
  @Post('auth/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAvatar(@Req() req: any, @UploadedFile() file: any) {
    const imageUrl = await this.uploadsService.saveFile(file, 'avatars');
    const oldUrl = await this.marketplaceService.updateAvatar(req.user.marketplaceUserId, imageUrl);
    if (oldUrl) {
      await this.uploadsService.deleteFile(oldUrl);
    }
    return { data: { avatarUrl: imageUrl } };
  }

  @UseGuards(MarketplaceJwtGuard)
  @Get('my-appointments')
  async getMyAppointments(
    @Req() req: any,
    @Query('filter') filter: string = 'upcoming',
    @Query('page') page: string = '1',
    @Query('perPage') perPage: string = '20',
  ) {
    return this.marketplaceService.getMyAppointments(
      req.user.marketplaceUserId,
      filter as 'upcoming' | 'past',
      parseInt(page, 10) || 1,
      Math.min(parseInt(perPage, 10) || 20, 100),
    );
  }

  @UseGuards(MarketplaceJwtGuard)
  @Get('my-stats')
  async getMyStats(@Req() req: any) {
    return this.marketplaceService.getMyStats(req.user.marketplaceUserId);
  }

  @UseGuards(MarketplaceJwtGuard)
  @Get('my-gallery')
  async getMyGallery(@Req() req: any) {
    return this.marketplaceService.getMyGallery(req.user.marketplaceUserId);
  }

  // ─── FAVORITES (auth required) ────────────────────────

  @UseGuards(MarketplaceJwtGuard)
  @Post('favorites/:tenantSlug')
  async toggleFavorite(
    @Req() req: any,
    @Param('tenantSlug') tenantSlug: string,
  ) {
    const result = await this.marketplaceService.toggleFavorite(
      req.user.marketplaceUserId,
      tenantSlug,
    );
    return { data: result };
  }

  @UseGuards(MarketplaceJwtGuard)
  @Get('my-favorites')
  async getMyFavorites(@Req() req: any) {
    return this.marketplaceService.getMyFavorites(req.user.marketplaceUserId);
  }

  // ─── DISCOVERY (public) ──────────────────────────────

  @Get('discover')
  async discover(@Query() dto: MarketplaceDiscoverDto) {
    return this.marketplaceService.discover(dto);
  }

  @UseGuards(MarketplaceJwtOptionalGuard)
  @Get('discover/:tenantSlug')
  async getBusinessDetail(
    @Req() req: any,
    @Param('tenantSlug') tenantSlug: string,
  ) {
    const marketplaceUserId = req.user?.marketplaceUserId;
    return this.marketplaceService.getBusinessDetail(tenantSlug, marketplaceUserId);
  }

  @Get('professional/:tenantSlug/:employeeId')
  async getProfessionalProfile(
    @Param('tenantSlug') tenantSlug: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.marketplaceService.getProfessionalProfile(tenantSlug, employeeId);
  }

  // ─── BOOKING (auth required) ─────────────────────────

  @UseGuards(MarketplaceJwtGuard)
  @Post('book/:tenantSlug')
  async book(
    @Req() req: any,
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: MarketplaceBookDto,
  ) {
    const result = await this.marketplaceService.bookAppointment(
      req.user.marketplaceUserId,
      tenantSlug,
      dto,
    );
    return { data: result };
  }

  @UseGuards(MarketplaceJwtGuard)
  @Post('checkout/:tenantSlug')
  async checkout(
    @Req() req: any,
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateCheckoutDto,
  ) {
    const result = await this.marketplaceService.createCheckoutSession(
      req.user.marketplaceUserId,
      tenantSlug,
      dto.appointmentId,
      this.stripeService,
      dto.returnUrl,
    );
    return { data: result };
  }

  // ─── REWARDS (auth required) ────────────────────────

  @UseGuards(MarketplaceJwtGuard)
  @Get('my-rewards')
  async getMyRewards(@Req() req: any) {
    return this.marketplaceService.getMyRewards(req.user.marketplaceUserId);
  }

  @Get(':tenantSlug/rewards')
  async getBusinessRewards(@Param('tenantSlug') tenantSlug: string) {
    return this.marketplaceService.getBusinessRewards(tenantSlug);
  }

  @UseGuards(MarketplaceJwtGuard)
  @Post('rewards/redeem')
  async redeemReward(
    @Req() req: any,
    @Body() body: { rewardId: string; tenantSlug: string },
  ) {
    const result = await this.marketplaceService.redeemReward(
      req.user.marketplaceUserId,
      body.tenantSlug,
      body.rewardId,
    );
    return { data: result };
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
