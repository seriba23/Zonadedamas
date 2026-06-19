import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CreatorCodesService } from './creator-codes.service';
import { CreatorPayoutsService } from './creator-payouts.service';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { CreateInfluencerDto, UpdateInfluencerDto } from './dto/influencer.dto';

@UseGuards(PlatformJwtAuthGuard)
@Controller('platform/influencers')
export class CreatorCodesController {
  constructor(
    private readonly service: CreatorCodesService,
    private readonly payouts: CreatorPayoutsService,
  ) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listInfluencers({
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      status,
      search,
    });
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.service.getInfluencerDetail(id);
  }

  @Post()
  async create(@Body() dto: CreateInfluencerDto, @Req() req: any) {
    return this.service.createInfluencer(dto, req.user.userId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateInfluencerDto) {
    return this.service.updateInfluencer(id, dto);
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Req() req: any) {
    return this.service.approveInfluencer(id, req.user.userId);
  }

  @Post(':id/suspend')
  async suspend(@Param('id') id: string) {
    return this.service.suspendInfluencer(id);
  }

  @Post(':id/reactivate')
  async reactivate(@Param('id') id: string) {
    return this.service.reactivateInfluencer(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.deleteInfluencer(id);
  }

  // ─── STRIPE CONNECT ───────────────────────────────

  @Get(':id/stripe/status')
  async stripeStatus(@Param('id') id: string) {
    return this.service.getStripeStatus(id);
  }

  @Post(':id/stripe/onboarding-link')
  async stripeOnboardingLink(
    @Param('id') id: string,
    @Body() body: { returnUrl?: string },
  ) {
    const returnUrl =
      body?.returnUrl || `${process.env.WEB_URL || 'http://localhost:3000'}/platform/creators`;
    return this.service.createStripeOnboardingLink(id, returnUrl);
  }

  // ─── ACCESO AL PANEL ──────────────────────────────

  @Post(':id/access/generate-password')
  async generatePassword(@Param('id') id: string) {
    return this.service.generatePassword(id);
  }

  @Post(':id/access/invite-link')
  async inviteLink(@Param('id') id: string) {
    return this.service.createInviteLink(id);
  }

  // ─── COMISIONES / PAYOUTS ─────────────────────────

  // Dispara manualmente la corrida mensual de comisiones (útil para pruebas).
  @Post('payouts/run')
  async runPayouts() {
    const result = await this.payouts.processMonthlyCommissions();
    return { data: result };
  }

  // Reintenta los transfers pendientes de un influencer ya onboardeado.
  @Post(':id/payouts/retry')
  async retryPayouts(@Param('id') id: string) {
    const result = await this.payouts.retryPendingTransfers(id);
    return { data: result };
  }
}
