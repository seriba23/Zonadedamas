// ─────────────────────────────────────────────────────────────────────────────
// fix-demo-subscription.ts — pone la suscripción del DEMO SALON en un estado
// coherente para probar el cobro: plan PLUS ($500 MXN) en estado "por pagar".
//
// El seed solo CREA la suscripción si no existe, así que re-seedear no corrige la
// BD que ya tiene el registro viejo (BASICO/$29.99/ACTIVE). Este script idempotente
// actualiza el tenant demo (tenantType/currency) y hace UPSERT de su suscripción a
// los valores nuevos. Correr con: cd apps/api && npm run db:fix-demo-sub
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo-salon' } });
  if (!tenant) {
    console.warn('⚠ No existe el tenant demo-salon. Corre primero el seed.');
    return;
  }

  // Negocio con equipo => tier PLUS ($500). tenantType gobierna el precio real.
  // subscriptionStatus se resetea porque el login lo pudo dejar en 'SUSPENDED'.
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { tenantType: 'BUSINESS', currency: 'MXN', subscriptionStatus: 'past_due' },
  });

  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  const graceEnds = new Date(now);
  graceEnds.setDate(graceEnds.getDate() + 7); // 7 días de gracia para regularizar

  // Estado PAST_DUE (pago pendiente), NO TRIAL: el login solo auto-suspende los
  // TRIAL vencidos, y el interceptor deja pasar lecturas + el POST de Stripe para
  // pagar. Así aparece "Renovar suscripción" y el pago con tarjeta funciona.
  const demoSubData = {
    plan: 'PLUS' as const,
    status: 'PAST_DUE' as const,
    monthlyAmountUsd: 500,
    baseMonthlyUsd: 500,
    perEmployeeUsd: 0,
    trialEndsAt: null,
    gracePeriodEndsAt: graceEnds,
    contractStartDate: now,
    contractEndDate: oneYearLater,
    nextBillingDate: now,
    stripeSubscriptionId: null,
    advancePaid: false,
  };

  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: demoSubData,
    create: { tenantId: tenant.id, ...demoSubData },
  });

  console.log('✔ Demo Salon → PLUS ($500 MXN), estado PAST_DUE (por pagar, sin auto-suspension).');
}

main()
  .then(() => console.log('✅ Listo.'))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
