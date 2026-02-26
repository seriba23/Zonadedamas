import { Controller, Get, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { PlanLimitsService } from './plan-limits.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('subscription')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly planLimitsService: PlanLimitsService,
  ) {}

  @Get()
  async getSubscription(@CurrentUser() user: JwtPayload) {
    const subscription = await this.subscriptionsService.getSubscription(user.tenantId);
    return { data: subscription };
  }

  @Get('usage')
  async getUsage(@CurrentUser() user: JwtPayload) {
    const usage = await this.planLimitsService.getUsage(user.tenantId);
    return { data: usage };
  }

  @Get('invoices')
  async getInvoices(@CurrentUser() user: JwtPayload) {
    const invoices = await this.subscriptionsService.getInvoices(user.tenantId);
    return { data: invoices };
  }
}
