import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import {
  CREATOR_COMMISSION,
  DISCOUNT_MONTHS,
  INFLUENCER_REACTIVATION_DAYS,
  tenantKind,
  monthsBetween,
  daysBetween,
} from './creator-codes.config';

const DAY_MS = 24 * 60 * 60 * 1000;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class CreatorPayoutsService implements OnModuleInit {
  private readonly logger = new Logger(CreatorPayoutsService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  onModuleInit() {
    // Chequeo diario. Idempotente por @@unique([usageId, forMonth]):
    // correr varias veces el mismo mes no duplica comisiones.
    setInterval(() => {
      this.processMonthlyCommissions().catch((e) =>
        this.logger.error(`cron comisiones falló: ${e.message}`),
      );
    }, DAY_MS);
    this.logger.log('Cron de comisiones de creador iniciado (chequeo diario)');
  }

  /**
   * Recorre los usos de código activos y, para los que están en mes 3+ con la
   * suscripción activa, genera el CreatorPayout del mes y hace el Transfer.
   * Aplica la ventana de reactivación de 60d para marcar clientes perdidos.
   */
  async processMonthlyCommissions(now: Date = new Date()) {
    if (this.running) {
      this.logger.warn('Ya hay una corrida en curso, se omite');
      return { processed: 0, paid: 0, pending: 0, lost: 0, skipped: true };
    }
    this.running = true;
    const forMonth = monthKey(now);
    let paid = 0;
    let pending = 0;
    let lost = 0;
    let processed = 0;

    try {
      const usages = await this.prisma.creatorCodeUsage.findMany({
        where: { lostAt: null },
        include: { code: { include: { influencer: true } } },
      });

      for (const usage of usages) {
        processed++;
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: usage.tenantId },
          include: { subscription: true },
        });
        if (!tenant) continue;

        const sub = tenant.subscription;
        const months = monthsBetween(usage.appliedAt, now);

        // Todavía en periodo de descuento (meses 1-2): aún no hay comisión.
        if (months < DISCOUNT_MONTHS) continue;

        const status = sub?.status;

        if (status === 'ACTIVE') {
          const result = await this.payCommission(usage, tenant, forMonth);
          if (result === 'paid') paid++;
          else if (result === 'pending') pending++;
        } else if (status === 'CANCELLED' || status === 'SUSPENDED') {
          // Ventana de 60d: si la pasó sin reactivar, el influencer pierde al cliente.
          if (sub?.cancelledAt) {
            const days = daysBetween(sub.cancelledAt, now);
            if (days > INFLUENCER_REACTIVATION_DAYS) {
              await this.prisma.creatorCodeUsage.update({
                where: { id: usage.id },
                data: { lostAt: now },
              });
              lost++;
            }
          }
          // Dentro de la ventana → comisión en pausa este mes (no se paga ni se pierde).
        }
      }

      this.logger.log(
        `Comisiones ${forMonth}: procesados=${processed} pagados=${paid} pendientes=${pending} perdidos=${lost}`,
      );
      return { processed, paid, pending, lost, forMonth };
    } finally {
      this.running = false;
    }
  }

  /**
   * Crea el payout del mes (idempotente) e intenta el Transfer si el influencer
   * ya completó su onboarding de Stripe. Si no, queda acumulado como pendiente.
   */
  private async payCommission(
    usage: any,
    tenant: any,
    forMonth: string,
  ): Promise<'paid' | 'pending' | 'duplicate'> {
    const kind = tenantKind(tenant.tenantType);
    const amount = CREATOR_COMMISSION[kind];
    const influencer = usage.code.influencer;

    // Crear el registro de comisión (idempotente por @@unique([usageId, forMonth]))
    let payout;
    try {
      payout = await this.prisma.creatorPayout.create({
        data: {
          influencerId: influencer.id,
          usageId: usage.id,
          amount,
          forMonth,
        },
      });
    } catch (err: any) {
      // Violación de unicidad → ya existe el payout de este mes para este uso
      return 'duplicate';
    }

    // Intentar el Transfer solo si la cuenta puede recibir pagos
    if (influencer.stripeOnboardingComplete && influencer.stripeAccountId) {
      try {
        const transfer = await this.stripe.createInfluencerTransfer(
          influencer.stripeAccountId,
          Number(amount),
          { payoutId: payout.id, usageId: usage.id, forMonth },
        );
        await this.prisma.creatorPayout.update({
          where: { id: payout.id },
          data: { stripeTransferId: transfer.id, transferredAt: new Date() },
        });
        return 'paid';
      } catch (err: any) {
        this.logger.error(`Transfer falló (payout ${payout.id}): ${err.message}`);
        return 'pending';
      }
    }

    // Sin onboarding → comisión acumulada, pendiente de pago
    return 'pending';
  }

  /**
   * Reintenta los Transfers de comisiones acumuladas (sin transferir) de un
   * influencer que ya completó su onboarding de Stripe.
   */
  async retryPendingTransfers(influencerId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
    });
    if (!influencer?.stripeOnboardingComplete || !influencer.stripeAccountId) {
      return { retried: 0, paid: 0, reason: 'Influencer sin onboarding de Stripe completo' };
    }

    const pending = await this.prisma.creatorPayout.findMany({
      where: { influencerId, transferredAt: null },
    });

    let paid = 0;
    for (const payout of pending) {
      try {
        const transfer = await this.stripe.createInfluencerTransfer(
          influencer.stripeAccountId,
          Number(payout.amount),
          { payoutId: payout.id, usageId: payout.usageId, forMonth: payout.forMonth },
        );
        await this.prisma.creatorPayout.update({
          where: { id: payout.id },
          data: { stripeTransferId: transfer.id, transferredAt: new Date() },
        });
        paid++;
      } catch (err: any) {
        this.logger.error(`Retry transfer falló (payout ${payout.id}): ${err.message}`);
      }
    }

    return { retried: pending.length, paid };
  }
}
