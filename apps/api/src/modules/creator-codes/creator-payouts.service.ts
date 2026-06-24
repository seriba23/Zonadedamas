// ─────────────────────────────────────────────────────────────────────────────
// SERVICIO DE COMISIONES (payouts). Es el "motor financiero" del módulo: cada
// mes recorre los referidos activos, calcula la comisión que toca al influencer
// y la transfiere por Stripe. Incluye un "cron" (tarea programada) que se ejecuta
// solo, y métodos para disparar/reintentar manualmente.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Injectable,    // marca la clase como servicio inyectable.
  Logger,        // utilidad para escribir mensajes en el log (consola/archivo).
  OnModuleInit,  // interfaz: si la clase la implementa, NestJS llama onModuleInit()
                 // automáticamente cuando el módulo termina de arrancar.
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
// Importamos las reglas económicas y los helpers de cálculo del archivo config.
import {
  CREATOR_COMMISSION,            // cuánto se paga por tipo de tenant
  DISCOUNT_MONTHS,               // meses de descuento antes de empezar a pagar
  INFLUENCER_REACTIVATION_DAYS,  // ventana de 60d tras cancelar
  tenantKind,                    // normaliza el tipo de tenant
  monthsBetween,                 // meses entre dos fechas
  daysBetween,                   // días entre dos fechas
} from './creator-codes.config';

// Milisegundos de un día (24h). Se usa como intervalo del cron diario.
const DAY_MS = 24 * 60 * 60 * 1000;

// monthKey: convierte una fecha en una etiqueta de mes "YYYY-MM" (ej. "2026-06").
// Sirve como identificador del mes al que pertenece una comisión.
function monthKey(d: Date): string {
  // getMonth() devuelve 0-11, por eso sumamos 1 para tener 1-12.
  // String(...).padStart(2, '0') rellena con un 0 a la izquierda si hace falta,
  // para que junio sea "06" y no "6" (siempre 2 dígitos).
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
// "implements OnModuleInit" obliga a la clase a tener el método onModuleInit().
export class CreatorPayoutsService implements OnModuleInit {
  // logger para registrar lo que va pasando. El nombre de la clase aparece en
  // cada línea del log para saber de dónde viene el mensaje.
  private readonly logger = new Logger(CreatorPayoutsService.name);
  // "running" = candado simple para no ejecutar dos corridas a la vez. Empieza
  // en false (no hay corrida en curso).
  private running = false;

  // Inyección del acceso a la base de datos y del servicio de Stripe.
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  // onModuleInit: lo llama NestJS al arrancar el módulo. Aquí montamos el cron.
  onModuleInit() {
    // Chequeo diario. Idempotente por @@unique([usageId, forMonth]):
    // correr varias veces el mismo mes no duplica comisiones.
    // setInterval ejecuta la función que le pasamos UNA VEZ CADA "DAY_MS" ms
    // (cada 24h) de forma indefinida mientras la app esté viva.
    setInterval(() => {
      // Lanzamos la corrida mensual. ".catch(...)" captura cualquier error de la
      // promesa para que un fallo NO tumbe la app: solo lo registra en el log.
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
  // processMonthlyCommissions: la corrida mensual. "now" por defecto es la fecha
  // actual, pero se puede pasar otra para pruebas. Recorre todos los referidos y,
  // para los que toca, paga la comisión o marca al cliente como perdido.
  async processMonthlyCommissions(now: Date = new Date()) {
    // Si ya hay una corrida en curso, salimos (evita duplicar trabajo/pagos).
    if (this.running) {
      this.logger.warn('Ya hay una corrida en curso, se omite');
      // "skipped: true" avisa a quien llamó que esta vez no se hizo nada.
      return { processed: 0, paid: 0, pending: 0, lost: 0, skipped: true };
    }
    this.running = true;          // ponemos el candado
    const forMonth = monthKey(now); // etiqueta del mes actual, ej. "2026-06"
    // Contadores del resumen de la corrida:
    let paid = 0;      // comisiones pagadas (transferidas) con éxito
    let pending = 0;   // comisiones generadas pero no transferidas aún
    let lost = 0;      // referidos marcados como perdidos este mes
    let processed = 0; // cuántos usos se revisaron en total

    // try/finally: pase lo que pase, el "finally" libera el candado al final.
    try {
      // Traemos todos los usos de código que AÚN no están perdidos (lostAt null),
      // incluyendo el código y, dentro, el influencer dueño (cadena de includes).
      const usages = await this.prisma.creatorCodeUsage.findMany({
        where: { lostAt: null },
        include: { code: { include: { influencer: true } } },
      });

      // Recorremos cada uso (cada cliente/negocio referido).
      for (const usage of usages) {
        processed++; // contamos este uso como procesado
        // Buscamos el negocio referido y su suscripción.
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: usage.tenantId },
          include: { subscription: true },
        });
        // Si el negocio ya no existe, saltamos al siguiente uso ("continue").
        if (!tenant) continue;

        const sub = tenant.subscription;                 // su suscripción (o null)
        const months = monthsBetween(usage.appliedAt, now); // meses desde que aplicó

        // Todavía en periodo de descuento (meses 1-2): aún no hay comisión.
        // "continue" salta al siguiente uso sin pagar nada.
        if (months < DISCOUNT_MONTHS) continue;

        const status = sub?.status; // estado de la suscripción (o undefined)

        if (status === 'ACTIVE') {
          // Suscripción activa y ya en mes 3+: corresponde pagar comisión.
          const result = await this.payCommission(usage, tenant, forMonth);
          // Según cómo fue, sumamos al contador correspondiente. (Si fue
          // 'duplicate' no sumamos nada: ya estaba contada en un mes anterior.)
          if (result === 'paid') paid++;
          else if (result === 'pending') pending++;
        } else if (status === 'CANCELLED' || status === 'SUSPENDED') {
          // Ventana de 60d: si la pasó sin reactivar, el influencer pierde al cliente.
          if (sub?.cancelledAt) {
            // Días transcurridos desde que se canceló la suscripción.
            const days = daysBetween(sub.cancelledAt, now);
            // Si superó la ventana de reactivación, se marca como perdido para
            // que en futuras corridas ya no se revise (queda excluido por lostAt).
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

      // Registramos un resumen de la corrida en el log.
      this.logger.log(
        `Comisiones ${forMonth}: procesados=${processed} pagados=${paid} pendientes=${pending} perdidos=${lost}`,
      );
      // Devolvemos el resumen a quien llamó (por ejemplo, el endpoint manual).
      return { processed, paid, pending, lost, forMonth };
    } finally {
      this.running = false; // liberamos el candado pase lo que pase
    }
  }

  /**
   * Crea el payout del mes (idempotente) e intenta el Transfer si el influencer
   * ya completó su onboarding de Stripe. Si no, queda acumulado como pendiente.
   */
  // payCommission: paga la comisión de UN uso para un mes concreto. Devuelve un
  // texto que indica el resultado: 'paid' (transferida), 'pending' (registrada
  // pero no transferida) o 'duplicate' (ya existía para este mes).
  private async payCommission(
    usage: any,
    tenant: any,
    forMonth: string,
  ): Promise<'paid' | 'pending' | 'duplicate'> {
    // Determinamos el tipo de tenant (BUSINESS/FREELANCER) y el monto que
    // corresponde según las reglas económicas del config.
    const kind = tenantKind(tenant.tenantType);
    const amount = CREATOR_COMMISSION[kind];
    // El influencer dueño del código (llegó incluido en el "usage").
    const influencer = usage.code.influencer;

    // Crear el registro de comisión (idempotente por @@unique([usageId, forMonth]))
    let payout;
    try {
      // Intentamos crear el payout. La base tiene una restricción única sobre
      // (usageId, forMonth): solo puede haber UNA comisión por uso y por mes.
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
      // (la corrida ya se ejecutó antes este mes). Devolvemos 'duplicate' y no
      // hacemos nada más: así correr la corrida varias veces no duplica pagos.
      return 'duplicate';
    }

    // Intentar el Transfer solo si la cuenta puede recibir pagos
    // (&& = ambas condiciones): debe haber completado el onboarding Y tener un
    // id de cuenta de Stripe donde depositar.
    if (influencer.stripeOnboardingComplete && influencer.stripeAccountId) {
      try {
        // Pedimos a Stripe que transfiera el dinero a la cuenta del influencer.
        // El tercer argumento son "metadatos" (referencias) para rastrear el pago.
        const transfer = await this.stripe.createInfluencerTransfer(
          influencer.stripeAccountId,
          Number(amount),
          { payoutId: payout.id, usageId: usage.id, forMonth },
        );
        // Si la transferencia salió bien, guardamos su id y la fecha en el payout.
        await this.prisma.creatorPayout.update({
          where: { id: payout.id },
          data: { stripeTransferId: transfer.id, transferredAt: new Date() },
        });
        return 'paid';
      } catch (err: any) {
        // Si la transferencia falló, dejamos el payout creado pero sin transferir.
        // Quedará como pendiente y se podrá reintentar después.
        this.logger.error(`Transfer falló (payout ${payout.id}): ${err.message}`);
        return 'pending';
      }
    }

    // Sin onboarding → comisión acumulada, pendiente de pago
    // El payout queda creado (el influencer la verá), pendiente de transferir
    // hasta que complete su configuración de Stripe.
    return 'pending';
  }

  /**
   * Reintenta los Transfers de comisiones acumuladas (sin transferir) de un
   * influencer que ya completó su onboarding de Stripe.
   */
  // retryPendingTransfers: reintenta transferir las comisiones que quedaron
  // pendientes (creadas pero sin transferir) de un influencer que YA completó su
  // onboarding de Stripe. Útil cuando antes no podía cobrar y ahora sí.
  async retryPendingTransfers(influencerId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: influencerId },
    });
    // "!influencer?.stripeOnboardingComplete || !influencer.stripeAccountId":
    //   - influencer?.stripeOnboardingComplete: false/undefined si no existe o no
    //     terminó onboarding; el "!" lo niega.
    //   - "||" (OR): basta que UNA de las dos condiciones sea verdadera.
    // En conjunto: si no completó onboarding O no tiene cuenta, no podemos pagar.
    if (!influencer?.stripeOnboardingComplete || !influencer.stripeAccountId) {
      return { retried: 0, paid: 0, reason: 'Influencer sin onboarding de Stripe completo' };
    }

    // Traemos sus comisiones pendientes (transferredAt = null = sin transferir).
    const pending = await this.prisma.creatorPayout.findMany({
      where: { influencerId, transferredAt: null },
    });

    let paid = 0; // cuántas logramos transferir en este reintento
    // Recorremos cada comisión pendiente e intentamos transferirla.
    for (const payout of pending) {
      try {
        const transfer = await this.stripe.createInfluencerTransfer(
          influencer.stripeAccountId,
          Number(payout.amount),
          { payoutId: payout.id, usageId: payout.usageId, forMonth: payout.forMonth },
        );
        // Si la transferencia funcionó, la marcamos como transferida.
        await this.prisma.creatorPayout.update({
          where: { id: payout.id },
          data: { stripeTransferId: transfer.id, transferredAt: new Date() },
        });
        paid++;
      } catch (err: any) {
        // Si una falla, registramos el error y seguimos con la siguiente (no
        // detenemos todo el reintento por un solo fallo).
        this.logger.error(`Retry transfer falló (payout ${payout.id}): ${err.message}`);
      }
    }

    // Devolvemos cuántas se intentaron (todas las pendientes) y cuántas se pagaron.
    return { retried: pending.length, paid };
  }
}
