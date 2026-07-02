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
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { tenantType: 'BUSINESS', currency: 'MXN' },
  });

  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  const trialEnded = new Date(now);
  trialEnded.setDate(trialEnded.getDate() - 3); // prueba vencida hace 3 días

  const demoSubData = {
    plan: 'PLUS' as const,
    status: 'TRIAL' as const,
    monthlyAmountUsd: 500,
    baseMonthlyUsd: 500,
    perEmployeeUsd: 0,
    trialEndsAt: trialEnded,
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

  console.log('✔ Demo Salon → PLUS ($500 MXN), estado por pagar (TRIAL vencido).');
}

main()
  .then(() => console.log('✅ Listo.'))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
