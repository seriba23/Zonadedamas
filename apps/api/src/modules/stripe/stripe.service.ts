import { Injectable, BadRequestException, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Stripe from 'stripe';
import {
  CREATOR_DISCOUNT,
  DISCOUNT_MONTHS,
  tenantKind,
} from '../creator-codes/creator-codes.config';

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

  // ─── CONNECT ONBOARDING (INFLUENCERS) ───────────────
  // Express accounts: onboarding simplificado + capability de transfers
  // para poder pagarles comisiones vía Transfer (Fase 4).

  async createInfluencerConnectLink(influencerId: string, returnUrl: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
    });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    let accountId = influencer.stripeAccountId;

    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type: 'express',
        email: influencer.email,
        business_type: 'individual',
        capabilities: {
          transfers: { requested: true },
        },
        metadata: { influencerId: influencer.id },
      });
      accountId = account.id;

      await this.prisma.influencer.update({
        where: { id: influencerId },
        data: { stripeAccountId: accountId },
      });
    }

    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return { url: accountLink.url };
  }

  /**
   * Transfiere comisión a la cuenta Connect del influencer. El influencer
   * absorbe la fee de Stripe (recibe el neto del payout a su banco; el Transfer
   * platform→connected no tiene fee adicional). Moneda = la del price de plataforma.
   */
  async createInfluencerTransfer(
    destinationAccountId: string,
    amountUnits: number,
    metadata: Record<string, string>,
  ): Promise<Stripe.Transfer> {
    const priceId = process.env.STRIPE_PLATFORM_PRICE_ID;
    let currency = 'usd';
    if (priceId) {
      try {
        const price = await this.stripe.prices.retrieve(priceId);
        currency = price.currency || 'usd';
      } catch (_) { /* usa usd por defecto */ }
    }

    return this.stripe.transfers.create({
      amount: Math.round(amountUnits * 100),
      currency,
      destination: destinationAccountId,
      metadata,
    });
  }

  async getInfluencerConnectStatus(influencerId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
    });
    if (!influencer) throw new NotFoundException('Influencer no encontrado');

    if (!influencer.stripeAccountId) {
      return { connected: false, stripeAccountId: null };
    }

    const account = await this.stripe.accounts.retrieve(influencer.stripeAccountId);
    // payouts_enabled: la cuenta puede RECIBIR transfers (lo que nos importa)
    const connected = !!account.payouts_enabled;

    if (connected !== influencer.stripeOnboardingComplete) {
      await this.prisma.influencer.update({
        where: { id: influencerId },
        data: { stripeOnboardingComplete: connected },
      });
    }

    return { connected, stripeAccountId: influencer.stripeAccountId };
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
    // La cuenta puede pertenecer a un tenant (Standard) o a un influencer (Express)
    const tenant = await this.prisma.tenant.findFirst({
      where: { stripeAccountId: account.id },
    });
    if (tenant) {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { stripeOnboardingComplete: !!account.charges_enabled },
      });
      return;
    }

    const influencer = await this.prisma.influencer.findFirst({
      where: { stripeAccountId: account.id },
    });
    if (influencer) {
      await this.prisma.influencer.update({
        where: { id: influencer.id },
        data: { stripeOnboardingComplete: !!account.payouts_enabled },
      });
    }
  }

  // ─── PLATFORM SUBSCRIPTIONS ─────────────────────────
  // Modelo PLANO: el negocio paga una cuota mensual fija según su tipo de cuenta:
  //   FREELANCER → PRO ($300/mes)   BUSINESS → PLUS ($500/mes)
  // El número de empleados NO afecta el cobro (queda como dato informativo).

  async getOrCreateCustomer(tenantId: string): Promise<string> {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (sub?.stripeCustomerId) return sub.stripeCustomerId;

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const customer = await this.stripe.customers.create({
      email: tenant.email,
      name: tenant.name,
      metadata: { tenantId },
    });

    await this.prisma.subscription.update({
      where: { tenantId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  /** Retrieves the client_secret from a Stripe subscription's first invoice. */
  private async getClientSecretFromSubscription(stripeSubId: string): Promise<string | null> {
    try {
      const stripeSub = await this.stripe.subscriptions.retrieve(stripeSubId);
      const invoiceId = typeof stripeSub.latest_invoice === 'string'
        ? stripeSub.latest_invoice
        : (stripeSub.latest_invoice as any)?.id;

      if (!invoiceId) return null;

      const invoice = await this.stripe.invoices.retrieve(invoiceId) as any;
      const piId = typeof invoice.payment_intent === 'string'
        ? invoice.payment_intent
        : invoice.payment_intent?.id;

      if (!piId) return null;

      const pi = await this.stripe.paymentIntents.retrieve(piId);
      this.logger.log(`[getClientSecret] pi=${pi.id} status=${pi.status} secret=${pi.client_secret ? 'OK' : 'NULL'}`);
      return pi.client_secret;
    } catch (err: any) {
      this.logger.error(`[getClientSecret] error: ${err.message}`);
      return null;
    }
  }

  // ─── CÓDIGOS DE CREADOR (descuento meses 1-2) ───────

  /**
   * Valida un código de creador para un tenant que va a activar su suscripción.
   * Reglas: código activo, influencer aprobado, y el tenant NO debe haber usado
   * ningún código antes (un solo uso de por vida).
   */
  async validateCreatorCodeForTenant(tenantId: string, rawCode: string) {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) return { valid: false, reason: 'Ingresa un código' };

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return { valid: false, reason: 'Negocio no encontrado' };

    // Un solo uso de por vida
    const priorUsage = await this.prisma.creatorCodeUsage.findUnique({
      where: { tenantId },
    });
    if (priorUsage) {
      return { valid: false, reason: 'Ya usaste un código de creador anteriormente' };
    }

    const creatorCode = await this.prisma.creatorCode.findUnique({
      where: { code },
      include: { influencer: true },
    });
    if (!creatorCode || !creatorCode.isActive) {
      return { valid: false, reason: 'Código inválido o inactivo' };
    }
    if (creatorCode.influencer.status !== 'APPROVED') {
      return { valid: false, reason: 'Código inválido o inactivo' };
    }

    const kind = tenantKind(tenant.tenantType);
    const discount = CREATOR_DISCOUNT[kind];

    return {
      valid: true,
      code,
      codeId: creatorCode.id,
      influencerId: creatorCode.influencerId,
      influencerName: `${creatorCode.influencer.firstName} ${creatorCode.influencer.lastName}`,
      discount,
      months: DISCOUNT_MONTHS,
    };
  }

  /** Crea un Stripe Coupon de monto fijo para los meses 1-2, en la moneda del price. */
  private async createCreatorCoupon(priceId: string, discountUnits: number): Promise<string> {
    const price = await this.stripe.prices.retrieve(priceId);
    const currency = price.currency || 'usd';
    const coupon = await this.stripe.coupons.create({
      amount_off: Math.round(discountUnits * 100),
      currency,
      duration: 'repeating',
      duration_in_months: DISCOUNT_MONTHS,
      name: `Creador -${discountUnits} (${DISCOUNT_MONTHS} meses)`,
    });
    return coupon.id;
  }

  /** Creates a fresh Stripe subscription and returns its clientSecret. */
  private async createFreshStripeSubscription(
    customerId: string,
    priceId: string,
    quantity: number,
    tenantId: string,
    employeeCount: number,
    monthlyAmount: number,
    creatorCode?: string,
  ): Promise<{ subscriptionId: string; clientSecret: string | null }> {
    // Validar y preparar cupón de creador (si aplica)
    let creatorContext: { codeId: string; couponId: string } | null = null;
    if (creatorCode) {
      const validation = await this.validateCreatorCodeForTenant(tenantId, creatorCode);
      if (validation.valid && validation.codeId) {
        const couponId = await this.createCreatorCoupon(priceId, validation.discount!);
        creatorContext = { codeId: validation.codeId, couponId };
      }
      // Si no es válido, se ignora silenciosamente (el UI ya validó antes).
    }

    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId, quantity }],
      ...(creatorContext ? { discounts: [{ coupon: creatorContext.couponId }] } : {}),
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      metadata: { tenantId, ...(creatorContext ? { creatorCodeId: creatorContext.codeId } : {}) },
    });

    // Registrar el uso del código (un solo uso de por vida garantizado por @@unique tenantId)
    if (creatorContext) {
      try {
        await this.prisma.creatorCodeUsage.create({
          data: { codeId: creatorContext.codeId, tenantId, discountMonthsLeft: DISCOUNT_MONTHS },
        });
      } catch (err: any) {
        this.logger.error(`[creatorCode] no se pudo registrar usage: ${err.message}`);
      }
    }

    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        billedEmployeeCount: employeeCount,
        monthlyAmountUsd: monthlyAmount, // monto PLANO del plan (300 PRO / 500 PLUS)
        status: 'ACTIVE', // will be confirmed by webhook; set optimistically
        cancelledAt: null,
      },
    });

    const clientSecret = await this.getClientSecretFromSubscription(subscription.id);
    this.logger.log(`[createFresh] sub=${subscription.id} clientSecret=${clientSecret ? 'OK' : 'NULL'}`);
    return { subscriptionId: subscription.id, clientSecret };
  }

  /**
   * Plan de plataforma según el tipo de cuenta (modelo PLANO, no por asiento):
   *  - FREELANCER → PRO ($300/mes)  → STRIPE_PRICE_PRO
   *  - BUSINESS   → PLUS ($500/mes)  → STRIPE_PRICE_PLUS
   * Fallback a STRIPE_PLATFORM_PRICE_ID si no están las nuevas vars.
   */
  private async platformPlanFor(tenantId: string): Promise<{ priceId: string; amount: number; isFreelancer: boolean }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tenantType: true },
    });
    const isFreelancer = tenant?.tenantType === 'FREELANCER';
    const priceId = isFreelancer
      ? (process.env.STRIPE_PRICE_PRO || process.env.STRIPE_PLATFORM_PRICE_ID)
      : (process.env.STRIPE_PRICE_PLUS || process.env.STRIPE_PLATFORM_PRICE_ID);
    if (!priceId) {
      throw new BadRequestException('Falta configurar el price de Stripe (STRIPE_PRICE_PRO / STRIPE_PRICE_PLUS)');
    }
    return { priceId, amount: isFreelancer ? 300 : 500, isFreelancer };
  }

  async createPlatformSubscription(tenantId: string, employeeCount: number, creatorCode?: string) {
    const { priceId, amount } = await this.platformPlanFor(tenantId);

    const customerId = await this.getOrCreateCustomer(tenantId);
    const quantity = 1; // Modelo plano: una sola licencia, sin multiplicar por empleados.
    const existingSub = await this.prisma.subscription.findUnique({ where: { tenantId } });

    // Try to reuse an existing Stripe subscription in usable state
    if (existingSub?.stripeSubscriptionId) {
      try {
        const stripeSub = await this.stripe.subscriptions.retrieve(existingSub.stripeSubscriptionId);
        const stripeStatus = (stripeSub as any).status;

        if (stripeStatus === 'active') {
          // Already paid & active — nothing to do
          await this.prisma.subscription.update({
            where: { tenantId },
            data: { status: 'ACTIVE', cancelledAt: null },
          });
          return { subscriptionId: stripeSub.id, clientSecret: null, reactivated: true };
        }

        if (stripeStatus === 'incomplete') {
          // Unpaid — get the existing payment intent (still valid for 23h)
          const clientSecret = await this.getClientSecretFromSubscription(existingSub.stripeSubscriptionId);
          if (clientSecret) return { subscriptionId: stripeSub.id, clientSecret, reactivated: false };
          // Payment intent expired — fall through to create new sub
        }
        // 'incomplete_expired', 'canceled', etc. — create fresh
      } catch (_) { /* sub not found in Stripe */ }

      // Clean up stale reference before creating new
      await this.prisma.subscription.update({
        where: { tenantId },
        data: { stripeSubscriptionId: null },
      });
    }

    const result = await this.createFreshStripeSubscription(customerId, priceId, quantity, tenantId, employeeCount, amount, creatorCode);
    return { ...result, reactivated: false };
  }

  async updateSubscriptionEmployeeCount(tenantId: string, employeeCount: number) {
    // Modelo PLANO: el número de empleados NO afecta el cobro (el plan es fijo
    // por tipo de cuenta). Solo registramos el conteo como dato informativo;
    // no se modifica la suscripción de Stripe ni el monto.
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) return;
    await this.prisma.subscription.update({
      where: { tenantId },
      data: { billedEmployeeCount: employeeCount },
    });
  }

  async cancelPlatformSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });

    let accessUntil = sub?.nextBillingDate?.toISOString() || new Date().toISOString();

    if (sub?.stripeSubscriptionId) {
      try {
        const stripeSub = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        const stripeStatus = (stripeSub as any).status;

        if (stripeStatus === 'active') {
          // Schedule cancellation at end of paid period
          const updated = await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
          accessUntil = new Date((updated as any).current_period_end * 1000).toISOString();
        } else {
          // Incomplete/expired — cancel immediately (user never paid)
          await this.stripe.subscriptions.cancel(sub.stripeSubscriptionId).catch(() => {});
        }
      } catch (_) {}
    }

    await this.prisma.subscription.update({
      where: { tenantId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), nextBillingDate: new Date(accessUntil) },
    });

    return { accessUntil };
  }

  async reactivatePlatformSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });

    if (sub?.stripeSubscriptionId) {
      try {
        const stripeSub = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        const stripeStatus = (stripeSub as any).status;

        // Active with cancel_at_period_end → just un-schedule cancellation
        if (stripeStatus === 'active') {
          if ((stripeSub as any).cancel_at_period_end) {
            await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
              cancel_at_period_end: false,
            });
          }
          await this.prisma.subscription.update({
            where: { tenantId },
            data: { status: 'ACTIVE', cancelledAt: null },
          });
          return { reactivated: true, clientSecret: null };
        }

        // Incomplete — try to get payment intent (valid < 23h)
        if (stripeStatus === 'incomplete') {
          const clientSecret = await this.getClientSecretFromSubscription(sub.stripeSubscriptionId);
          if (clientSecret) return { reactivated: false, clientSecret };
        }
      } catch (_) {}

      // Stale or expired Stripe sub — clear before creating fresh
      await this.prisma.subscription.update({
        where: { tenantId },
        data: { stripeSubscriptionId: null },
      }).catch(() => {});
    }

    // Create fresh subscription (handles all the payment intent retrieval robustly)
    const preview = await this.getSubscriptionPreview(tenantId);
    const result = await this.createPlatformSubscription(tenantId, preview.activeEmployeeCount);

    if (result.reactivated) return { reactivated: true, clientSecret: null };
    return { reactivated: false, clientSecret: result.clientSecret };
  }

  async advancePayment(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new NotFoundException('Suscripción no encontrada');
    if (sub.advancePaid) throw new BadRequestException('Ya tienes un mes adelantado pendiente.');

    const customerId = await this.getOrCreateCustomer(tenantId);
    const amount = Math.round(Number(sub.monthlyAmountUsd) * 100); // cents

    const pi = await this.stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customerId,
      metadata: { tenantId, type: 'advance_payment' },
      description: 'Pago adelantado mensualidad Siliba',
    });

    return { clientSecret: pi.client_secret, amount: Number(sub.monthlyAmountUsd) };
  }

  async confirmAdvancePayment(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new NotFoundException('Suscripción no encontrada');

    const nextBilling = new Date(sub.nextBillingDate);
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        advancePaid: true,
        nextBillingDate: nextBilling,
        lastPaymentDate: new Date(),
      },
    });
  }

  async switchToAnnual(tenantId: string, employeeCount: number) {
    const annualPriceId = process.env.STRIPE_ANNUAL_PRICE_ID;
    if (!annualPriceId) throw new BadRequestException('STRIPE_ANNUAL_PRICE_ID no configurado');

    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    const customerId = await this.getOrCreateCustomer(tenantId);
    // Modelo flat por tenantType. Plan anual = 12 meses con 15% de descuento.
    //  - FREELANCER: 300 * 12 * 0.85 = 3060 MXN/ano
    //  - BUSINESS:   500 * 12 * 0.85 = 5100 MXN/ano
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tenantType: true },
    });
    const monthlyFlat = tenant?.tenantType === 'FREELANCER' ? 300 : 500;
    const quantity = 1; // Plan flat: una sola "licencia base", el employeeCount queda como metadato.
    const annualTotal = Math.round(monthlyFlat * 12 * 0.85);

    // Cancel existing monthly subscription at period end
    if (sub?.stripeSubscriptionId) {
      try {
        const existing = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        if ((existing as any).status === 'active' || (existing as any).status === 'incomplete') {
          await this.stripe.subscriptions.cancel(sub.stripeSubscriptionId);
        }
      } catch (_) {}
    }

    // Create annual subscription
    const annualSub = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: annualPriceId, quantity }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: { tenantId, planInterval: 'ANNUAL' },
    });

    const periodEnd = new Date((annualSub as any).current_period_end * 1000);

    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        stripeSubscriptionId: annualSub.id,
        stripePriceId: annualPriceId,
        planInterval: 'ANNUAL',
        billedEmployeeCount: employeeCount,
        monthlyAmountUsd: annualTotal / 12,
        annualAmountUsd: annualTotal,
        annualPeriodEnd: periodEnd,
        availableLicenses: 0,
      },
    });

    const inv = annualSub.latest_invoice as any;
    const pi = inv?.payment_intent;
    let clientSecret: string | null = null;
    if (typeof pi === 'string') {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(pi);
      clientSecret = paymentIntent.client_secret;
    } else if (pi?.client_secret) {
      clientSecret = pi.client_secret;
    }

    return { clientSecret, annualTotal, periodEnd: periodEnd.toISOString() };
  }

  async addLicensesToAnnualPlan(tenantId: string, count: number) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new NotFoundException('Suscripción no encontrada');
    if (sub.planInterval !== 'ANNUAL') throw new BadRequestException('Solo disponible en plan anual.');

    // Use available licenses first
    const toCharge = Math.max(0, count - sub.availableLicenses);
    const freeFromPool = count - toCharge;

    if (toCharge === 0) {
      // Use from pool, no payment needed
      await this.prisma.subscription.update({
        where: { tenantId },
        data: {
          availableLicenses: { decrement: freeFromPool },
          billedEmployeeCount: { increment: count },
        },
      });
      return { clientSecret: null, charged: false, freeFromPool: count };
    }

    // Calculate pro-rated months remaining
    const periodEnd = sub.annualPeriodEnd || new Date();
    const monthsLeft = Math.max(1, Math.ceil(
      (periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44)
    ));
    const pricePerLicense = Math.round(8.5 * monthsLeft * 100); // $8.50/month with 15% discount
    const totalAmount = pricePerLicense * toCharge;

    const customerId = await this.getOrCreateCustomer(tenantId);
    const pi = await this.stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      customer: customerId,
      metadata: { tenantId, type: 'add_licenses', count: String(toCharge), freeFromPool: String(freeFromPool) },
      description: `${toCharge} licencia(s) adicional(es) — ${monthsLeft} mes(es) restantes`,
    });

    return {
      clientSecret: pi.client_secret,
      charged: true,
      toCharge,
      freeFromPool,
      monthsLeft,
      amountUsd: totalAmount / 100,
    };
  }

  async confirmLicenseAddition(tenantId: string, toCharge: number, freeFromPool: number) {
    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        availableLicenses: { decrement: freeFromPool },
        billedEmployeeCount: { increment: toCharge + freeFromPool },
        lastPaymentDate: new Date(),
      },
    });
  }

  async createBillingPortalSession(tenantId: string, returnUrl: string) {
    const customerId = await this.getOrCreateCustomer(tenantId);
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  async getSubscriptionPreview(tenantId: string) {
    // Modelo flat: precio fijo segun tenantType, sin cargo por empleado.
    //  - FREELANCER (independiente, plan Pro):  $300 MXN/mes
    //  - BUSINESS  (empresa, plan Plus):       $500 MXN/mes
    // El conteo de empleados se mantiene como dato informativo pero ya no
    // afecta el monto del cobro.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tenantType: true },
    });
    const activeEmployeeCount = await this.prisma.employee.count({
      where: { tenantId, isActive: true },
    });
    const totalMonthly = tenant?.tenantType === 'FREELANCER' ? 300 : 500;
    return {
      activeEmployeeCount,
      baseAmount: totalMonthly,
      employeeAmount: 0,
      totalMonthly,
    };
  }

  /**
   * Cambia un tenant FREELANCER a BUSINESS (Pro -> Plus).
   * - En produccion (Stripe configurado): genera payment intent para el
   *   prorrateo del primer cobro y devuelve clientSecret.
   * - En local/dev (sin Stripe): solo actualiza tenantType + subscription
   *   en DB y devuelve { changed: true } sin clientSecret.
   *
   * No reduce de BUSINESS a FREELANCER. No es idempotente: si ya es
   * BUSINESS, lanza BadRequest.
   */
  async upgradeToPlus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, tenantType: true },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');
    if (tenant.tenantType === 'BUSINESS') {
      throw new BadRequestException('Tu cuenta ya esta en el plan Plus.');
    }

    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new NotFoundException('Suscripcion no encontrada');

    const newMonthly = 500;
    const newAnnual = Math.round(newMonthly * 12 * 0.85);
    const isAnnual = sub.planInterval === 'ANNUAL';

    // Si Stripe esta configurado y hay subscription activa de Stripe,
    // intentamos prorratear ($500-$300=$200 al mes hasta fin de periodo).
    // En este flow inicial nos limitamos a actualizar DB y dejar que el
    // proximo ciclo cobre el monto nuevo. El upgrade con cobro inmediato
    // queda como mejora futura.
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { tenantType: 'BUSINESS' },
    });

    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        plan: 'PLUS',
        monthlyAmountUsd: isAnnual ? newAnnual / 12 : newMonthly,
        baseMonthlyUsd: newMonthly,
        perEmployeeUsd: 0,
        annualAmountUsd: isAnnual ? newAnnual : sub.annualAmountUsd,
      },
    });

    // Cambiar el precio en la suscripción de Stripe (PRO → PLUS) para que el
    // próximo cobro sea $500 y no siga en $300. Prorratea hasta fin de periodo.
    if (sub.stripeSubscriptionId) {
      const plusPrice = process.env.STRIPE_PRICE_PLUS || process.env.STRIPE_PLATFORM_PRICE_ID;
      if (plusPrice) {
        try {
          const stripeSub = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
          const itemId = stripeSub.items.data[0]?.id;
          if (itemId) {
            await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
              items: [{ id: itemId, price: plusPrice, quantity: 1 }],
              proration_behavior: 'create_prorations',
            });
          }
        } catch (_) { /* si Stripe falla, la BD ya quedó en PLUS; se reconcilia al renovar */ }
      }
    }

    return {
      changed: true,
      newMonthly,
      newAnnual,
      message: 'Tu cuenta cambio al plan Plus. El nuevo monto aplica desde el proximo cobro.',
    };
  }

  // ─── SUBSCRIPTION WEBHOOK HANDLERS ──────────────────

  async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const tenantId = subscription.metadata?.tenantId;
    if (!tenantId) return;

    const statusMap: Record<string, string> = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELLED',
      unpaid: 'PAST_DUE',
      trialing: 'ACTIVE',
    };

    const newStatus = statusMap[subscription.status] || 'PAST_DUE';
    const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);

    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status: newStatus as any,
        nextBillingDate: currentPeriodEnd,
        contractEndDate: currentPeriodEnd,
      },
    });
  }

  async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const tenantId = subscription.metadata?.tenantId;
    if (!tenantId) return;

    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        stripeSubscriptionId: null,
      },
    });
  }

  async handleInvoicePaid(invoice: Stripe.Invoice) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    const sub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!sub) return;

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'ACTIVE', lastPaymentDate: new Date() },
    });

    // Create invoice record
    const amount = invoice.amount_paid / 100;
    await this.prisma.invoice.create({
      data: {
        subscriptionId: sub.id,
        tenantId: sub.tenantId,
        invoiceNumber: `INV-${Date.now()}`,
        amountUsd: amount,
        baseAmount: 10,
        employeeAmount: amount - 10,
        employeeCount: sub.billedEmployeeCount,
        status: 'PAID',
        periodStart: new Date((invoice as any).period_start * 1000),
        periodEnd: new Date((invoice as any).period_end * 1000),
        dueDate: new Date((invoice as any).period_end * 1000),
        paidAt: new Date(),
        stripeInvoiceId: invoice.id,
      },
    });
  }

  async createSetupIntent(tenantId: string) {
    const customerId = await this.getOrCreateCustomer(tenantId);

    const setupIntent = await this.stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: { tenantId },
    });

    // Mark the card as default payment method on the subscription after setup
    return { clientSecret: setupIntent.client_secret };
  }

  async attachDefaultPaymentMethod(tenantId: string, paymentMethodId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub?.stripeCustomerId) return;

    // Attach payment method to customer
    await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: sub.stripeCustomerId,
    });

    // Set as default on customer
    await this.stripe.customers.update(sub.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Set as default on subscription if exists
    if (sub.stripeSubscriptionId) {
      await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
        default_payment_method: paymentMethodId,
      });
    }
  }

  async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    const sub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!sub) return;

    const gracePeriodEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'PAST_DUE', gracePeriodEndsAt },
    });
  }
}
