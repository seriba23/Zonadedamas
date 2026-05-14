/**
 * Elimina citas duplicadas en el tenant demo-salon. Considera "duplicada" una
 * cita con el mismo clientId + employeeId + startTime que otra ya existente.
 * Mantiene la más antigua (por createdAt) y borra las copias.
 *
 * USO: npx ts-node prisma/dedup-appointments.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'demo-salon' },
    select: { id: true, name: true },
  });
  if (!tenant) {
    console.log('No existe el tenant demo-salon.');
    return;
  }

  const apts = await prisma.appointment.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, clientId: true, employeeId: true, startTime: true },
  });

  const seen = new Set<string>();
  const toDelete: string[] = [];
  for (const apt of apts) {
    const key = `${apt.clientId}#${apt.employeeId}#${apt.startTime.toISOString()}`;
    if (seen.has(key)) {
      toDelete.push(apt.id);
    } else {
      seen.add(key);
    }
  }

  console.log(
    `Tenant "${tenant.name}": ${apts.length} citas en total, ${toDelete.length} duplicadas para borrar.`,
  );

  if (toDelete.length === 0) {
    console.log('Nada que hacer.');
    return;
  }

  const [payItems, pays, items, hist, photos, deleted] = await prisma.$transaction([
    prisma.paymentItem.deleteMany({
      where: { payment: { appointmentId: { in: toDelete } } },
    }),
    prisma.payment.deleteMany({ where: { appointmentId: { in: toDelete } } }),
    prisma.appointmentItem.deleteMany({ where: { appointmentId: { in: toDelete } } }),
    prisma.appointmentStatusHistory.deleteMany({
      where: { appointmentId: { in: toDelete } },
    }),
    prisma.appointmentPhoto.deleteMany({ where: { appointmentId: { in: toDelete } } }),
    prisma.appointment.deleteMany({ where: { id: { in: toDelete } } }),
  ]);

  console.log(
    `✓ Borradas ${deleted.count} citas duplicadas (${pays.count} pagos, ${items.count} items, ` +
      `${payItems.count} pay-items, ${hist.count} historial, ${photos.count} fotos).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
