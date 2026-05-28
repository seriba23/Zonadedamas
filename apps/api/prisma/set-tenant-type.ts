/**
 * Forza el tenantType de un Tenant. Util cuando el backfill automatico
 * marco a alguien incorrectamente.
 *
 * Uso (busca el tenant por email del Owner del User):
 *   npm run db:set-tenant-type -- admin@siliba.com BUSINESS
 *   npm run db:set-tenant-type -- freelancer@correo.com FREELANCER
 *
 * Tambien puede recibir el tenant slug:
 *   npm run db:set-tenant-type -- --slug demo-salon BUSINESS
 */
import { PrismaClient, TenantType } from '@prisma/client';

const prisma = new PrismaClient();

function isValidType(v: string): v is TenantType {
  return v === 'FREELANCER' || v === 'BUSINESS';
}

async function main() {
  const args = process.argv.slice(2);
  let bySlug = false;
  if (args[0] === '--slug') {
    bySlug = true;
    args.shift();
  }
  const identifier = args[0];
  const newType = (args[1] || '').toUpperCase();

  if (!identifier || !isValidType(newType)) {
    console.error(
      'Uso: npm run db:set-tenant-type -- <email|--slug slug> <BUSINESS|FREELANCER>',
    );
    process.exit(1);
  }

  let tenant;
  if (bySlug) {
    tenant = await prisma.tenant.findUnique({ where: { slug: identifier } });
  } else {
    const user = await prisma.user.findUnique({
      where: { email: identifier },
      select: { tenantId: true },
    });
    if (!user || !user.tenantId) {
      console.error(`No existe User con email "${identifier}" o no tiene tenantId.`);
      process.exit(1);
    }
    tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
  }

  if (!tenant) {
    console.error(`No se encontro el tenant para "${identifier}".`);
    process.exit(1);
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { tenantType: newType },
  });

  console.log(`OK - Tenant "${tenant.name}" (${tenant.slug}) actualizado a ${newType}`);
  console.log(`Vuelve a iniciar sesion para que el frontend recoja el nuevo valor.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
