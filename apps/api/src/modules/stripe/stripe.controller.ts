import {
  Controller,
  Post,
  Get,
  Param,
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
    }

    return res.json({ received: true });
  }
}
