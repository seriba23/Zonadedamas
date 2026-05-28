/**
 * Backfill: para tenants FREELANCER, asigna su unico empleado a todos
 * los servicios que no tengan ninguna asignacion en employee_services.
 *
 * Util una sola vez despues del fix de auto-asignacion (commit que
 * agrega creacion de employee_services en services.service.ts:create).
 *
 * Uso:
 *   npm run db:backfill-freelancer-services
 *
 * Con email del owner: solo ese tenant.
 *   npm run db:backfill-freelancer-services -- silvia@ibarra.com
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const filterEmail = process.argv[2];

  const tenantWhere: any = { tenantType: 'FREELANCER' };
  if (filterEmail) {
    const user = await prisma.user.findUnique({
      where: { email: filterEmail },
      select: { tenantId: true },
    });
    if (!user?.tenantId) {
      console.error(`No existe User con email "${filterEmail}" o no tiene tenant.`);
      process.exit(1);
    }
    tenantWhere.id = user.tenantId;
  }

  const tenants = await prisma.tenant.findMany({
    where: tenantWhere,
    select: { id: true, name: true, slug: true },
  });

  if (tenants.length === 0) {
    console.log('No hay tenants FREELANCER que procesar.');
    return;
  }

  let totalAssigned = 0;
  for (const tenant of tenants) {
    const employee = await prisma.employee.findFirst({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!employee) {
      console.log(`  [${tenant.name}] sin empleado activo, omitido`);
      continue;
    }

    // Servicios del tenant que NO tienen asignacion alguna
    const orphanServices = await prisma.service.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        employeeServices: { none: {} },
      },
      select: { id: true, name: true },
    });

    if (orphanServices.length === 0) {
      console.log(`  [${tenant.name}] todos los servicios ya tienen asignacion`);
      continue;
    }

    await prisma.employeeService.createMany({
      data: orphanServices.map((s) => ({
        employeeId: employee.id,
        serviceId: s.id,
      })),
    });

    console.log(
      `  [${tenant.name}] asignados ${orphanServices.length} servicio(s) a ${employee.firstName} ${employee.lastName}`,
    );
    totalAssigned += orphanServices.length;
  }

  console.log(`\nOK - ${totalAssigned} asignacion(es) creada(s) en ${tenants.length} tenant(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
