import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ClientPortalService } from './client-portal.service';
import { ClientJwtGuard } from './guards/client-jwt.guard';
import { ClientRegisterDto } from './dto/client-register.dto';
import { ClientLoginDto } from './dto/client-login.dto';
import { ClientUpdateProfileDto, ClientChangePasswordDto } from './dto/client-update-profile.dto';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('portal/:tenantSlug')
export class ClientPortalController {
  constructor(private readonly clientPortalService: ClientPortalService) {}

  // ─── AUTH (public, no guard) ─────────────────────────

  @Post('auth/register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(
    @Param('tenantSlug') slug: string,
    @Body() dto: ClientRegisterDto,
  ) {
    const tenant = await this.clientPortalService.resolveTenant(slug);
    return this.clientPortalService.register(dto, tenant.id);
  }

  @Post('auth/login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(
    @Param('tenantSlug') slug: string,
    @Body() dto: ClientLoginDto,
  ) {
    const tenant = await this.clientPortalService.resolveTenant(slug);
    return this.clientPortalService.login(dto, tenant.id);
  }

  @Post('auth/refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.clientPortalService.refresh(refreshToken);
  }

  @Post('auth/logout')
  async logout(@Body('refreshToken') refreshToken: string) {
    await this.clientPortalService.logout(refreshToken);
    return { message: 'Sesión cerrada' };
  }

  @Get('auth/me')
  @UseGuards(ClientJwtGuard)
  async getMe(@Req() req: any) {
    return this.clientPortalService.getMe(req.user.clientId, req.user.tenantId);
  }

  // ─── APPOINTMENTS ────────────────────────────────────

  @Get('appointments')
  @UseGuards(ClientJwtGuard)
  async getAppointments(
    @Req() req: any,
    @Query('filter') filter: 'upcoming' | 'past' | 'all' = 'all',
  ) {
    return this.clientPortalService.getAppointments(
      req.user.clientId,
      req.user.tenantId,
      filter,
    );
  }

  @Get('appointments/:id')
  @UseGuards(ClientJwtGuard)
  async getAppointmentDetail(@Param('id') id: string, @Req() req: any) {
    return this.clientPortalService.getAppointmentDetail(
      id,
      req.user.clientId,
      req.user.tenantId,
    );
  }

  @Post('appointments/:id/cancel')
  @UseGuards(ClientJwtGuard)
  async cancelAppointment(
    @Param('id') id: string,
    @Req() req: any,
    @Body('reason') reason?: string,
  ) {
    return this.clientPortalService.cancelAppointment(
      id,
      req.user.clientId,
      req.user.tenantId,
      reason,
    );
  }

  @Post('appointments/:id/reschedule')
  @UseGuards(ClientJwtGuard)
  async rescheduleAppointment(
    @Param('id') id: string,
    @Req() req: any,
    @Body('startTime') startTime: string,
    @Body('employeeId') employeeId?: string,
  ) {
    return this.clientPortalService.rescheduleAppointment(
      id,
      req.user.clientId,
      req.user.tenantId,
      startTime,
      employeeId,
    );
  }

  // ─── REVIEWS ─────────────────────────────────────────

  @Post('appointments/:id/review')
  @UseGuards(ClientJwtGuard)
  async createReview(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: CreateReviewDto,
  ) {
    return this.clientPortalService.createReview(
      id,
      req.user.clientId,
      req.user.tenantId,
      dto,
    );
  }

  @Get('reviews')
  @UseGuards(ClientJwtGuard)
  async getMyReviews(@Req() req: any) {
    return this.clientPortalService.getMyReviews(
      req.user.clientId,
      req.user.tenantId,
    );
  }

  // ─── PHOTOS ──────────────────────────────────────────

  @Get('appointments/:id/photos')
  @UseGuards(ClientJwtGuard)
  async getAppointmentPhotos(@Param('id') id: string, @Req() req: any) {
    return this.clientPortalService.getAppointmentPhotos(
      id,
      req.user.clientId,
      req.user.tenantId,
    );
  }

  @Get('service-history')
  @UseGuards(ClientJwtGuard)
  async getServiceHistory(@Req() req: any) {
    return this.clientPortalService.getServiceHistory(
      req.user.clientId,
      req.user.tenantId,
    );
  }

  // ─── BOOKING ─────────────────────────────────────────

  @Get('services')
  @UseGuards(ClientJwtGuard)
  async getServices(@Param('tenantSlug') slug: string, @Req() req: any) {
    return this.clientPortalService.getServices(req.user.tenantId);
  }

  @Get('employees')
  @UseGuards(ClientJwtGuard)
  async getEmployees(@Param('tenantSlug') slug: string, @Req() req: any) {
    return this.clientPortalService.getEmployees(req.user.tenantId);
  }

  @Post('availability')
  @UseGuards(ClientJwtGuard)
  async getAvailability(@Req() req: any, @Body() body: any) {
    return this.clientPortalService.getAvailability(
      body.serviceIds,
      body.startDate,
      body.endDate,
      req.user.tenantId,
      body.employeeId,
      body.locationId,
    );
  }

  @Post('book')
  @UseGuards(ClientJwtGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async book(@Req() req: any, @Body() body: any) {
    return this.clientPortalService.book(req.user.clientId, req.user.tenantId, {
      employeeId: body.employeeId,
      serviceIds: body.serviceIds,
      startTime: body.startTime,
      notes: body.notes,
    });
  }

  // ─── PROFILE ─────────────────────────────────────────

  @Put('profile')
  @UseGuards(ClientJwtGuard)
  async updateProfile(@Req() req: any, @Body() dto: ClientUpdateProfileDto) {
    return this.clientPortalService.updateProfile(
      req.user.clientId,
      req.user.tenantId,
      dto,
    );
  }

  @Put('profile/password')
  @UseGuards(ClientJwtGuard)
  async changePassword(@Req() req: any, @Body() dto: ClientChangePasswordDto) {
    return this.clientPortalService.changePassword(
      req.user.clientId,
      req.user.tenantId,
      dto,
    );
  }
}
