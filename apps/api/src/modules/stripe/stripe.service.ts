import { Injectable, BadRequestException, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Stripe from 'stripe';

const UNPAID_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes

@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;
  private feePercent: number;

  constructor(private prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2026-02-25.clover',
    });
    this.feePercent = parseInt(process.env.STRIPE_PLATFORM_FEE_PERCENT || '5', 10);
  }

  onModuleInit() {
    // Start cleanup job for unpaid appointments
    setInterval(() => this.cancelUnpaidAppointments(), CLEANUP_INTERVAL_MS);
    this.logger.log('Unpaid appointment cleanup job started (every 5 min)');
  }

  // ─── CLEANUP UNPAID APPOINTMENTS ────────────────────

  private async cancelUnpaidAppointments() {
    try {
      const cutoff = new Date(Date.now() - UNPAID_TIMEOUT_MS);

      // Find PENDING payments older than 30 min with STRIPE method
      const expiredPayments = await this.prisma.payment.findMany({
        where: {
          status: 'PENDING',
          paymentMethod: 'STRIPE',
          createdAt: { lt: cutoff },
        },
        select: { id: true, appointmentId: true },
      });

      if (expiredPayments.length === 0) return;

      for (const payment of expiredPayments) {
        // Cancel the appointment
        if (payment.appointmentId) {
          await this.prisma.appointment.update({
            where: { id: payment.appointmentId },
            data: { status: 'CANCELLED' },
          });
        }

        // Delete the pending payment
        await this.prisma.payment.delete({ where: { id: payment.id } });
      }

      this.logger.log(`Cancelled ${expiredPayments.length} unpaid appointment(s)`);
    } catch (err) {
      this.logger.error('Error in unpaid cleanup job:', err);
    }
  }

  // ─── CONNECT ONBOARDING ─────────────────────────────

  async createConnectAccountLink(tenantId: string, returnUrl: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    let accountId = tenant.stripeAccountId;

    // Create Stripe Connect account if not exists
    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type: 'standard',
        email: tenant.email,
        business_profile: {
          name: tenant.name,
          url: `https://siliba.com/marketplace/${tenant.slug}`,
        },
      });
      accountId = account.id;

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeAccountId: accountId },
      });
    }

    // Generate onboarding link
    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return { url: accountLink.url };
  }

  async getConnectStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    if (!tenant.stripeAccountId) {
      return { connected: false, stripeAccountId: null };
    }

    // Check actual status with Stripe
    const account = await this.stripe.accounts.retrieve(tenant.stripeAccountId);
    const connected = !!account.charges_enabled;

    // Sync if changed
    if (connected !== tenant.stripeOnboardingComplete) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeOnboardingComplete: connected },
      });
    }

    return { connected, stripeAccountId: tenant.stripeAccountId };
  }

  // ─── CHECKOUT SESSION ───────────────────────────────

  async createCheckoutSession(params: {
    tenantId: string;
    appointmentId: string;
    clientId: string;
    lineItems: { name: string; amount: number; quantity: number }[];
    currency: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: params.tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');
    if (!tenant.stripeAccountId || !tenant.stripeOnboardingComplete) {
      throw new BadRequestException('Este negocio no acepta pagos online');
    }

    // Check no existing completed payment
    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        appointmentId: params.appointmentId,
        status: 'COMPLETED',
      },
    });
    if (existingPayment) {
      throw new BadRequestException('Esta cita ya fue pagada');
    }

    const totalCents = params.lineItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
    const feeCents = Math.round(totalCents * this.feePercent / 100);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: params.lineItems.map((item) => ({
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: { name: item.name },
          unit_amount: item.amount,
        },
        quantity: item.quantity,
      })),
      payment_intent_data: {
        application_fee_amount: feeCents,
        transfer_data: {
          destination: tenant.stripeAccountId,
        },
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        appointmentId: params.appointmentId,
        tenantId: params.tenantId,
        clientId: params.clientId,
      },
    });

    // Create pending Payment record
    const totalDecimal = totalCents / 100;
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: params.appointmentId },
    });

    await this.prisma.payment.create({
      data: {
        tenantId: params.tenantId,
        appointmentId: params.appointmentId,
        clientId: params.clientId,
        locationId: appointment?.locationId || '',
        amount: totalDecimal,
        totalAmount: totalDecimal,
        currency: params.currency,
        paymentMethod: 'STRIPE',
        status: 'PENDING',
        stripeSessionId: session.id,
      },
    });

    return { checkoutUrl: session.url };
  }

  // ─── VERIFY SESSION (fallback when webhooks don't arrive) ──

  async verifyAndCompleteSession(sessionId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { stripeSessionId: sessionId },
    });
    if (!payment) return null;
    if (payment.status === 'COMPLETED') return payment;

    // Check with Stripe directly
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') {
      return this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          stripePaymentIntentId: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || null,
        },
      });
    }

    return payment;
  }

  // ─── WEBHOOKS ───────────────────────────────────────

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new BadRequestException('Webhook secret not configured');
    }
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const { appointmentId } = session.metadata || {};
    if (!appointmentId) return;

    const payment = await this.prisma.payment.findFirst({
      where: { stripeSessionId: session.id },
    });
    if (!payment || payment.status === 'COMPLETED') return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        stripePaymentIntentId: typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id || null,
      },
    });
  }

  async handleCheckoutExpired(session: Stripe.Checkout.Session) {
    const payment = await this.prisma.payment.findFirst({
      where: { stripeSessionId: session.id, status: 'PENDING' },
    });
    if (payment) {
      await this.prisma.payment.delete({ where: { id: payment.id } });
    }
  }

  async handleAccountUpdated(account: Stripe.Account) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { stripeAccountId: account.id },
    });
    if (!tenant) return;

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { stripeOnboardingComplete: !!account.charges_enabled },
    });
  }
}
