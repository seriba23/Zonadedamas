/**
 * Cambia tenant.timezone de 'America/New_York' a 'America/Mexico_City'
 * (o al timezone que se pase como argumento).
 *
 * Antes registerFreelancer y registerIndividual creaban tenants con
 * timezone NY por default. Esto rompia el calculo "ahora vs slot" del
 * marketplace para tenants reales en Mexico, escondiendo slots aun
 * disponibles del dia.
 *
 * Uso:
 *   npm run db:fix-tenant-timezone
 *     # cambia TODOS los tenants con America/New_York a America/Mexico_City
 *
 *   npm run db:fix-tenant-timezone -- silvia@ibarra.com
 *     # solo el tenant de ese owner
 *
 *   npm run db:fix-tenant-timezone -- "" America/Bogota
 *     # todos los con NY -> Bogota
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const filterEmail = process.argv[2] || '';
  const newTimezone = process.argv[3] || 'America/Mexico_City';

  const where: any = { timezone: 'America/New_York' };
  if (filterEmail) {
    const user = await prisma.user.findUnique({
      where: { email: filterEmail },
      select: { tenantId: true },
    });
    if (!user?.tenantId) {
      console.error(`No existe User con email "${filterEmail}" o no tiene tenant.`);
      process.exit(1);
    }
    where.id = user.tenantId;
    // Si fue por email, no filtramos por timezone — actualizamos sin importar.
    delete where.timezone;
  }

  const tenants = await prisma.tenant.findMany({
    where,
    select: { id: true, name: true, slug: true, timezone: true },
  });

  if (tenants.length === 0) {
    console.log('No hay tenants que actualizar.');
    return;
  }

  for (const t of tenants) {
    await prisma.tenant.update({
      where: { id: t.id },
      data: { timezone: newTimezone },
    });
    console.log(`  ${t.name} (${t.slug}): ${t.timezone} -> ${newTimezone}`);
  }
  console.log(`\nOK - ${tenants.length} tenant(s) actualizado(s).`);
  console.log(`Las queries de disponibilidad ahora respetaran la TZ correcta.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
