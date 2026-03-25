import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockPrismaService = {
  tenant: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  payment: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  appointment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockStripeApi = {
  accounts: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  accountLinks: {
    create: jest.fn(),
  },
  checkout: {
    sessions: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
  },
};

// ---------------------------------------------------------------------------
// StripeService inline implementation
// ---------------------------------------------------------------------------

class StripeService {
  private feePercent = 5;

  constructor(
    private readonly prisma: typeof mockPrismaService,
    private readonly stripe: typeof mockStripeApi,
  ) {}

  async createConnectAccountLink(tenantId: string, returnUrl: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    let accountId = tenant.stripeAccountId;

    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type: 'standard',
        email: tenant.email,
      });
      accountId = account.id;

      await this.prisma.tenant.update({
        where: { id: tenantId },
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

  async getConnectStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    if (!tenant.stripeAccountId) {
      return { connected: false, stripeAccountId: null };
    }

    const account = await this.stripe.accounts.retrieve(tenant.stripeAccountId);
    const connected = !!account.charges_enabled;

    if (connected !== tenant.stripeOnboardingComplete) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeOnboardingComplete: connected },
      });
    }

    return { connected, stripeAccountId: tenant.stripeAccountId };
  }

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

    const existingPayment = await this.prisma.payment.findFirst({
      where: { appointmentId: params.appointmentId, status: 'COMPLETED' },
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
        transfer_data: { destination: tenant.stripeAccountId },
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        appointmentId: params.appointmentId,
        tenantId: params.tenantId,
        clientId: params.clientId,
      },
    });

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

  async verifyAndCompleteSession(sessionId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { stripeSessionId: sessionId },
    });
    if (!payment) return null;
    if (payment.status === 'COMPLETED') return payment;

    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') {
      return this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          stripePaymentIntentId: session.payment_intent,
        },
      });
    }

    return payment;
  }

  async handleCheckoutCompleted(session: { id: string; metadata: { appointmentId: string }; payment_intent: string }) {
    const payment = await this.prisma.payment.findFirst({
      where: { stripeSessionId: session.id },
    });
    if (!payment || payment.status === 'COMPLETED') return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        stripePaymentIntentId: session.payment_intent,
      },
    });
  }

  async cancelUnpaidAppointments(cutoffMs: number) {
    const cutoff = new Date(Date.now() - cutoffMs);
    const expiredPayments = await this.prisma.payment.findMany({
      where: {
        status: 'PENDING',
        paymentMethod: 'STRIPE',
        createdAt: { lt: cutoff },
      },
      select: { id: true, appointmentId: true },
    });

    for (const payment of expiredPayments) {
      if (payment.appointmentId) {
        await this.prisma.appointment.update({
          where: { id: payment.appointmentId },
          data: { status: 'CANCELLED' },
        });
      }
      await this.prisma.payment.delete({ where: { id: payment.id } });
    }

    return expiredPayments.length;
  }
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MOCK_TENANT = {
  id: 'tenant-1',
  name: 'Demo Salon',
  slug: 'demo-salon',
  email: 'admin@siliba.com',
  stripeAccountId: 'acct_123456',
  stripeOnboardingComplete: true,
};

const MOCK_TENANT_NO_STRIPE = {
  ...MOCK_TENANT,
  id: 'tenant-2',
  stripeAccountId: null,
  stripeOnboardingComplete: false,
};

const MOCK_APPOINTMENT = {
  id: 'apt-1',
  tenantId: 'tenant-1',
  locationId: 'loc-1',
  clientId: 'client-1',
};

const MOCK_PAYMENT_PENDING = {
  id: 'pay-1',
  appointmentId: 'apt-1',
  status: 'PENDING',
  stripeSessionId: 'cs_test_123',
};

const MOCK_PAYMENT_COMPLETED = {
  id: 'pay-2',
  appointmentId: 'apt-1',
  status: 'COMPLETED',
  stripeSessionId: 'cs_test_456',
};

const CHECKOUT_PARAMS = {
  tenantId: 'tenant-1',
  appointmentId: 'apt-1',
  clientId: 'client-1',
  lineItems: [
    { name: 'Corte de Cabello', amount: 2500, quantity: 1 },
    { name: 'Blowout', amount: 3500, quantity: 1 },
  ],
  currency: 'MXN',
  successUrl: 'http://localhost:3000/marketplace/demo-salon?payment=success',
  cancelUrl: 'http://localhost:3000/marketplace/demo-salon?payment=cancelled',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StripeService', () => {
  let service: StripeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StripeService(mockPrismaService, mockStripeApi);
  });

  describe('createConnectAccountLink', () => {
    // 1. Create new Stripe account for tenant without one
    it('should create Stripe account and return onboarding URL', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(MOCK_TENANT_NO_STRIPE);
      mockStripeApi.accounts.create.mockResolvedValue({ id: 'acct_new' });
      mockStripeApi.accountLinks.create.mockResolvedValue({ url: 'https://connect.stripe.com/setup/...' });

      const result = await service.createConnectAccountLink('tenant-2', 'http://localhost:3000/settings/payments');

      expect(mockStripeApi.accounts.create).toHaveBeenCalled();
      expect(mockPrismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-2' },
        data: { stripeAccountId: 'acct_new' },
      });
      expect(result.url).toContain('stripe.com');
    });

    // 2. Reuse existing Stripe account
    it('should reuse existing Stripe account', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(MOCK_TENANT);
      mockStripeApi.accountLinks.create.mockResolvedValue({ url: 'https://connect.stripe.com/setup/...' });

      await service.createConnectAccountLink('tenant-1', 'http://localhost:3000/settings/payments');

      expect(mockStripeApi.accounts.create).not.toHaveBeenCalled();
    });

    // 3. Throw if tenant not found
    it('should throw NotFoundException for invalid tenant', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.createConnectAccountLink('bad-id', 'http://localhost:3000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getConnectStatus', () => {
    // 4. Return connected status
    it('should return connected=true when charges enabled', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(MOCK_TENANT);
      mockStripeApi.accounts.retrieve.mockResolvedValue({ charges_enabled: true });

      const result = await service.getConnectStatus('tenant-1');

      expect(result.connected).toBe(true);
      expect(result.stripeAccountId).toBe('acct_123456');
    });

    // 5. Return not connected when no stripe account
    it('should return connected=false when no Stripe account', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(MOCK_TENANT_NO_STRIPE);

      const result = await service.getConnectStatus('tenant-2');

      expect(result.connected).toBe(false);
      expect(result.stripeAccountId).toBeNull();
    });
  });

  describe('createCheckoutSession', () => {
    // 6. Create checkout session successfully
    it('should create checkout session and payment record', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(MOCK_TENANT);
      mockPrismaService.payment.findFirst.mockResolvedValue(null);
      mockPrismaService.appointment.findUnique.mockResolvedValue(MOCK_APPOINTMENT);
      mockStripeApi.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test_new',
        url: 'https://checkout.stripe.com/pay/cs_test_new',
      });

      const result = await service.createCheckoutSession(CHECKOUT_PARAMS);

      expect(result.checkoutUrl).toContain('checkout.stripe.com');
      expect(mockStripeApi.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          payment_intent_data: expect.objectContaining({
            application_fee_amount: 300, // 5% of 6000 cents
            transfer_data: { destination: 'acct_123456' },
          }),
        }),
      );
      expect(mockPrismaService.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'PENDING',
          paymentMethod: 'STRIPE',
          stripeSessionId: 'cs_test_new',
          totalAmount: 60, // 6000 cents = $60
        }),
      });
    });

    // 7. Reject if tenant has no Stripe
    it('should throw if tenant has no Stripe connected', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(MOCK_TENANT_NO_STRIPE);

      await expect(
        service.createCheckoutSession(CHECKOUT_PARAMS),
      ).rejects.toThrow('no acepta pagos online');
    });

    // 8. Reject if appointment already paid
    it('should throw if appointment already has completed payment', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(MOCK_TENANT);
      mockPrismaService.payment.findFirst.mockResolvedValue(MOCK_PAYMENT_COMPLETED);

      await expect(
        service.createCheckoutSession(CHECKOUT_PARAMS),
      ).rejects.toThrow('ya fue pagada');
    });

    // 9. Calculate fee correctly
    it('should calculate 5% platform fee', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(MOCK_TENANT);
      mockPrismaService.payment.findFirst.mockResolvedValue(null);
      mockPrismaService.appointment.findUnique.mockResolvedValue(MOCK_APPOINTMENT);
      mockStripeApi.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/x' });

      const params = {
        ...CHECKOUT_PARAMS,
        lineItems: [{ name: 'Service', amount: 10000, quantity: 1 }], // $100 = 10000 cents
      };

      await service.createCheckoutSession(params);

      expect(mockStripeApi.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent_data: expect.objectContaining({
            application_fee_amount: 500, // 5% of 10000
          }),
        }),
      );
    });
  });

  describe('verifyAndCompleteSession', () => {
    // 10. Complete payment when Stripe confirms paid
    it('should mark payment as COMPLETED when Stripe says paid', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValue(MOCK_PAYMENT_PENDING);
      mockStripeApi.checkout.sessions.retrieve.mockResolvedValue({
        payment_status: 'paid',
        payment_intent: 'pi_123',
      });
      mockPrismaService.payment.update.mockResolvedValue({ ...MOCK_PAYMENT_PENDING, status: 'COMPLETED' });

      const result = await service.verifyAndCompleteSession('cs_test_123');

      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: {
          status: 'COMPLETED',
          stripePaymentIntentId: 'pi_123',
        },
      });
      expect(result.status).toBe('COMPLETED');
    });

    // 11. Return null for unknown session
    it('should return null for unknown session', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValue(null);

      const result = await service.verifyAndCompleteSession('cs_unknown');

      expect(result).toBeNull();
    });

    // 12. Skip if already completed
    it('should not update already completed payment', async () => {
      mockPrismaService.payment.findFirst.mockResolvedValue(MOCK_PAYMENT_COMPLETED);

      const result = await service.verifyAndCompleteSession('cs_test_456');

      expect(mockStripeApi.checkout.sessions.retrieve).not.toHaveBeenCalled();
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('cancelUnpaidAppointments', () => {
    // 13. Cancel expired unpaid appointments
    it('should cancel appointments with expired PENDING payments', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([
        { id: 'pay-expired-1', appointmentId: 'apt-expired-1' },
        { id: 'pay-expired-2', appointmentId: 'apt-expired-2' },
      ]);

      const count = await service.cancelUnpaidAppointments(30 * 60 * 1000);

      expect(count).toBe(2);
      expect(mockPrismaService.appointment.update).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.payment.delete).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.appointment.update).toHaveBeenCalledWith({
        where: { id: 'apt-expired-1' },
        data: { status: 'CANCELLED' },
      });
    });

    // 14. No-op when no expired payments
    it('should do nothing when no expired payments exist', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([]);

      const count = await service.cancelUnpaidAppointments(30 * 60 * 1000);

      expect(count).toBe(0);
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
    });
  });
});
