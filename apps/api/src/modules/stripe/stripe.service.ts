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

  // ─── PLATFORM SUBSCRIPTIONS ─────────────────────────
  // Tenants pay the platform owner a monthly fee:
  // $10 base + $10 per active employee = quantity of (1 + employeeCount) seats at $10/seat.

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

  /** Creates a fresh Stripe subscription and returns its clientSecret. */
  private async createFreshStripeSubscription(
    customerId: string,
    priceId: string,
    quantity: number,
    tenantId: string,
    employeeCount: number,
  ): Promise<{ subscriptionId: string; clientSecret: string | null }> {
    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId, quantity }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      metadata: { tenantId },
    });

    const pricePerSeat = 10;
    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        billedEmployeeCount: employeeCount,
        monthlyAmountUsd: quantity * pricePerSeat,
        status: 'ACTIVE', // will be confirmed by webhook; set optimistically
        cancelledAt: null,
      },
    });

    const clientSecret = await this.getClientSecretFromSubscription(subscription.id);
    this.logger.log(`[createFresh] sub=${subscription.id} clientSecret=${clientSecret ? 'OK' : 'NULL'}`);
    return { subscriptionId: subscription.id, clientSecret };
  }

  async createPlatformSubscription(tenantId: string, employeeCount: number) {
    const priceId = process.env.STRIPE_PLATFORM_PRICE_ID;
    if (!priceId) throw new BadRequestException('STRIPE_PLATFORM_PRICE_ID no configurado');

    const customerId = await this.getOrCreateCustomer(tenantId);
    const quantity = 1 + employeeCount;
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

    const result = await this.createFreshStripeSubscription(customerId, priceId, quantity, tenantId, employeeCount);
    return { ...result, reactivated: false };
  }

  async updateSubscriptionEmployeeCount(tenantId: string, employeeCount: number) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub?.stripeSubscriptionId) return;

    const stripeSub = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) return;

    const quantity = 1 + employeeCount;

    await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: itemId, quantity }],
      proration_behavior: 'always_invoice',
    });

    const pricePerSeat = 10;
    await this.prisma.subscription.update({
      where: { tenantId },
      data: {
        billedEmployeeCount: employeeCount,
        monthlyAmountUsd: quantity * pricePerSeat,
      },
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
