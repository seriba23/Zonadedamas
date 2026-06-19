import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreatorPortalService } from './creator-portal.service';
import { CreatorJwtGuard } from './guards/creator-jwt.guard';
import {
  CreatorLoginDto,
  CreatorRegisterDto,
  CreatorSetPasswordDto,
  CreatorChangePasswordDto,
} from './dto/creator-auth.dto';

@Controller('creator')
export class CreatorPortalController {
  constructor(private readonly service: CreatorPortalService) {}

  // ─── Público ──────────────────────────────────────

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('auth/login')
  async login(@Body() dto: CreatorLoginDto) {
    const data = await this.service.login(dto);
    return { data };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('auth/register')
  async register(@Body() dto: CreatorRegisterDto) {
    const data = await this.service.register(dto);
    return { data };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('auth/set-password')
  async setPassword(@Body() dto: CreatorSetPasswordDto) {
    const data = await this.service.setPasswordFromToken(dto);
    return { data };
  }

  // ─── Protegido (creator-jwt) ──────────────────────

  @UseGuards(CreatorJwtGuard)
  @Get('me')
  async me(@Req() req: any) {
    return this.service.me(req.user.influencerId);
  }

  @UseGuards(CreatorJwtGuard)
  @Post('change-password')
  async changePassword(@Req() req: any, @Body() dto: CreatorChangePasswordDto) {
    return this.service.changePassword(req.user.influencerId, dto);
  }

  @UseGuards(CreatorJwtGuard)
  @Get('dashboard')
  async dashboard(@Req() req: any) {
    return this.service.dashboard(req.user.influencerId);
  }

  @UseGuards(CreatorJwtGuard)
  @Get('stripe/status')
  async stripeStatus(@Req() req: any) {
    return this.service.stripeStatus(req.user.influencerId);
  }

  @UseGuards(CreatorJwtGuard)
  @Post('stripe/onboarding-link')
  async stripeOnboarding(@Req() req: any) {
    return this.service.stripeOnboardingLink(req.user.influencerId);
  }
}
