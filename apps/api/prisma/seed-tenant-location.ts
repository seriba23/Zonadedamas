/**
 * seed-tenant-location.ts
 *
 * Actualiza Demo Salon con ubicacion real en Guadalajara, MX:
 * - Tenant: address + timezone "America/Mexico_City"
 * - Primera Location activa: address + timezone + lat/lng aprox
 *
 * Uso: cd apps/api && npm run db:seed-tenant-location
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADDRESS = 'C. Manuel de Gorostiza 3665, Jardines de San Francisco, 44790 Guadalajara, Jal.';
const TIMEZONE = 'America/Mexico_City';
// Aprox para Jardines de San Francisco, Guadalajara
const LAT = 20.6324;
const LNG = -103.4170;

async function main() {
  console.log('📍 Actualizando ubicacion de Demo Salon → Guadalajara, MX\n');

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo-salon' } });
  if (!tenant) {
    console.error('❌ Tenant "demo-salon" no encontrado.');
    process.exit(1);
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { address: ADDRESS, timezone: TIMEZONE },
  });
  console.log(`✓ Tenant actualizado: ${tenant.name}`);
  console.log(`  Address:  ${ADDRESS}`);
  console.log(`  Timezone: ${TIMEZONE}\n`);

  // Actualizar la primera Location activa (si hay)
  const location = await prisma.location.findFirst({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (location) {
    await prisma.location.update({
      where: { id: location.id },
      data: {
        address: ADDRESS,
        timezone: TIMEZONE,
        latitude: LAT,
        longitude: LNG,
      },
    });
    console.log(`✓ Location "${location.name}" actualizada`);
    console.log(`  Address:  ${ADDRESS}`);
    console.log(`  Timezone: ${TIMEZONE}`);
    console.log(`  Lat/Lng:  ${LAT}, ${LNG}`);
  } else {
    console.log('! No se encontró Location activa (saltada).');
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('💥 Error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
