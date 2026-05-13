/**
 * Limpia los Payments y Appointments del tenant Demo Salon y vuelve a
 * sembrar la data demo con citas COMPLETED distribuidas en los últimos 7
 * días + citas futuras HOY y próximos días. Útil cuando los datos demo
 * existentes ya no se ven coherentes (p.ej. todos los pagos amontonados
 * en el día que se corrió el seed anterior).
 *
 * USO: npx ts-node prisma/reset-demo.ts
 *
 * NOTA: solo afecta al tenant con slug 'demo-salon'. Otros tenants no se
 * tocan.
 */
import { PrismaClient } from '@prisma/client';
import seedDemo from './seed-demo';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'demo-salon' },
    select: { id: true, name: true },
  });

  if (!tenant) {
    console.log('No existe el tenant demo-salon. Corre primero el seed normal.');
    return;
  }

  console.log(`Limpiando datos transaccionales del tenant "${tenant.name}"...`);

  // Orden importa por FKs: PaymentItem → Payment, AppointmentItem +
  // AppointmentStatusHistory → Appointment.
  const [paymentItems, payments, aptItems, aptHistory, aptPhotos, appointments] =
    await prisma.$transaction([
      prisma.paymentItem.deleteMany({
        where: { payment: { tenantId: tenant.id } },
      }),
      prisma.payment.deleteMany({ where: { tenantId: tenant.id } }),
      prisma.appointmentItem.deleteMany({
        where: { appointment: { tenantId: tenant.id } },
      }),
      prisma.appointmentStatusHistory.deleteMany({
        where: { appointment: { tenantId: tenant.id } },
      }),
      prisma.appointmentPhoto.deleteMany({
        where: { appointment: { tenantId: tenant.id } },
      }),
      prisma.appointment.deleteMany({ where: { tenantId: tenant.id } }),
    ]);

  console.log(
    `  ✓ Eliminados: ${appointments.count} citas, ${payments.count} pagos, ` +
      `${aptItems.count} apt-items, ${paymentItems.count} pay-items, ` +
      `${aptHistory.count} historial, ${aptPhotos.count} fotos`,
  );

  console.log('Re-sembrando data demo coherente (seed es idempotente)...');
  await seedDemo();
  console.log('✓ Listo. La cuenta demo ahora muestra ingresos en los últimos 7 días.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
