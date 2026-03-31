import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  Res,
  UseGuards,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  // ─── CONNECT ONBOARDING ─────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('connect/onboard')
  async connectOnboard(@Req() req: any) {
    const tenantId = req.user.tenantId;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const returnUrl = `${frontendUrl}/settings/payments?stripe=callback`;

    const result = await this.stripeService.createConnectAccountLink(tenantId, returnUrl);
    return { data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Get('connect/status')
  async connectStatus(@Req() req: any) {
    const result = await this.stripeService.getConnectStatus(req.user.tenantId);
    return { data: result };
  }

  // ─── PLATFORM SUBSCRIPTION ──────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('subscription/create')
  async createSubscription(@Req() req: any) {
    const tenantId = req.user.tenantId;
    const preview = await this.stripeService.getSubscriptionPreview(tenantId);
    const result = await this.stripeService.createPlatformSubscription(tenantId, preview.activeEmployeeCount);
    return { data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription/preview')
  async subscriptionPreview(@Req() req: any) {
    const result = await this.stripeService.getSubscriptionPreview(req.user.tenantId);
    return { data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/cancel')
  async cancelSubscription(@Req() req: any) {
    const result = await this.stripeService.cancelPlatformSubscription(req.user.tenantId);
    return { data: { cancelled: true, accessUntil: result?.accessUntil || null } };
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/reactivate')
  async reactivateSubscription(@Req() req: any) {
    const result = await this.stripeService.reactivatePlatformSubscription(req.user.tenantId);
    return { data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/setup-intent')
  async setupIntent(@Req() req: any) {
    const result = await this.stripeService.createSetupIntent(req.user.tenantId);
    return { data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/attach-payment-method')
  async attachPaymentMethod(@Req() req: any, @Body() body: { paymentMethodId: string }) {
    await this.stripeService.attachDefaultPaymentMethod(req.user.tenantId, body.paymentMethodId);
    return { data: { success: true } };
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/advance-payment')
  async advancePayment(@Req() req: any) {
    const result = await this.stripeService.advancePayment(req.user.tenantId);
    return { data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/advance-payment/confirm')
  async confirmAdvancePayment(@Req() req: any) {
    await this.stripeService.confirmAdvancePayment(req.user.tenantId);
    return { data: { success: true } };
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/switch-annual')
  async switchToAnnual(@Req() req: any) {
    const preview = await this.stripeService.getSubscriptionPreview(req.user.tenantId);
    const result = await this.stripeService.switchToAnnual(req.user.tenantId, preview.activeEmployeeCount);
    return { data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/add-licenses')
  async addLicenses(@Req() req: any, @Body() body: { count: number }) {
    const result = await this.stripeService.addLicensesToAnnualPlan(req.user.tenantId, body.count ?? 1);
    return { data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription/add-licenses/confirm')
  async confirmLicenses(@Req() req: any, @Body() body: { toCharge: number; freeFromPool: number }) {
    await this.stripeService.confirmLicenseAddition(req.user.tenantId, body.toCharge, body.freeFromPool);
    return { data: { success: true } };
  }

  // ─── VERIFY SESSION ──────────────────────────────────

  @Get('verify-session/:sessionId')
  async verifySession(@Param('sessionId') sessionId: string) {
    const payment = await this.stripeService.verifyAndCompleteSession(sessionId);
    return { data: { status: payment?.status || 'NOT_FOUND' } };
  }

  // ─── WEBHOOK ────────────────────────────────────────

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
    @Res() res: Response,
  ) {
    let event;
    try {
      event = this.stripeService.constructWebhookEvent(req.rawBody, signature);
    } catch (err: any) {
      console.error('Stripe webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.stripeService.handleCheckoutCompleted(event.data.object as any);
        break;
      case 'checkout.session.expired':
        await this.stripeService.handleCheckoutExpired(event.data.object as any);
        break;
      case 'account.updated':
        await this.stripeService.handleAccountUpdated(event.data.object as any);
        break;
      case 'customer.subscription.updated':
        await this.stripeService.handleSubscriptionUpdated(event.data.object as any);
        break;
      case 'customer.subscription.deleted':
        await this.stripeService.handleSubscriptionDeleted(event.data.object as any);
        break;
      case 'invoice.paid':
        await this.stripeService.handleInvoicePaid(event.data.object as any);
        break;
      case 'invoice.payment_failed':
        await this.stripeService.handleInvoicePaymentFailed(event.data.object as any);
        break;
    }

    return res.json({ received: true });
  }
}
