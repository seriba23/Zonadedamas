/**
 * Actualiza monthlyAmountUsd, baseMonthlyUsd y annualAmountUsd de todas
 * las suscripciones segun el modelo flat por tenantType.
 *
 *   - FREELANCER -> 300 MXN/mes (3060 MXN/ano con 15% off)
 *   - BUSINESS   -> 500 MXN/mes (5100 MXN/ano con 15% off)
 *
 * Sin argumentos: actualiza todas las suscripciones.
 * Con argumento: actualiza solo el tenant cuyo User Owner tiene ese email.
 *
 * Uso:
 *   npm run db:fix-subscription-amounts
 *   npm run db:fix-subscription-amounts -- admin@siliba.com
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FREELANCER_MONTHLY = 300;
const BUSINESS_MONTHLY = 500;
const ANNUAL_DISCOUNT = 0.85;

async function main() {
  const filterEmail = process.argv[2];

  const where: any = {};
  if (filterEmail) {
    const user = await prisma.user.findUnique({
      where: { email: filterEmail },
      select: { tenantId: true },
    });
    if (!user?.tenantId) {
      console.error(`No existe User con email "${filterEmail}" o no tiene tenant.`);
      process.exit(1);
    }
    where.tenantId = user.tenantId;
  }

  const subscriptions = await prisma.subscription.findMany({
    where,
    include: { tenant: { select: { id: true, name: true, slug: true, tenantType: true } } },
  });

  if (subscriptions.length === 0) {
    console.log('No hay suscripciones que actualizar.');
    return;
  }

  let count = 0;
  for (const sub of subscriptions) {
    const monthly = sub.tenant.tenantType === 'FREELANCER' ? FREELANCER_MONTHLY : BUSINESS_MONTHLY;
    const annual = Math.round(monthly * 12 * ANNUAL_DISCOUNT);
    const isAnnual = sub.planInterval === 'ANNUAL';

    await prisma.subscription.update({
      where: { tenantId: sub.tenantId },
      data: {
        monthlyAmountUsd: isAnnual ? annual / 12 : monthly,
        baseMonthlyUsd: monthly,
        perEmployeeUsd: 0,
        billedEmployeeCount: 1,
        annualAmountUsd: isAnnual ? annual : sub.annualAmountUsd,
      },
    });
    console.log(
      `  ${sub.tenant.name} (${sub.tenant.slug}) [${sub.tenant.tenantType}] -> ${monthly} MXN/mes`,
    );
    count++;
  }
  console.log(`\nOK - ${count} suscripcion(es) actualizada(s).`);
  console.log(`Cierra sesion y vuelve a entrar para que la UI tome los nuevos valores.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
