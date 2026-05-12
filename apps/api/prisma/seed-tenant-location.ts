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

const SUCURSALES = [
  {
    name: 'Guadalajara',
    address: 'C. Manuel de Gorostiza 3665, Jardines de San Francisco, 44790 Guadalajara, Jal.',
    timezone: 'America/Mexico_City',
    lat: 20.6324,
    lng: -103.4170,
  },
  {
    name: 'San Pedro Garza García',
    address: 'Río Moctezuma 303, Del Valle, 66220 San Pedro Garza García, N.L.',
    timezone: 'America/Monterrey',
    lat: 25.6498,
    lng: -100.4042,
  },
];

async function main() {
  console.log('📍 Actualizando ubicacion de Demo Salon → Guadalajara, MX\n');

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo-salon' } });
  if (!tenant) {
    console.error('❌ Tenant "demo-salon" no encontrado.');
    process.exit(1);
  }

  // Actualiza el tenant con la sede principal (primera sucursal).
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { address: SUCURSALES[0].address, timezone: SUCURSALES[0].timezone },
  });
  console.log(`✓ Tenant actualizado: ${tenant.name}`);
  console.log(`  Sede principal: ${SUCURSALES[0].address}`);
  console.log(`  Timezone:       ${SUCURSALES[0].timezone}\n`);

  // Actualizar/crear locations (ordenadas por createdAt asc).
  const existingLocations = await prisma.location.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'asc' },
  });

  for (let i = 0; i < SUCURSALES.length; i++) {
    const sucursal = SUCURSALES[i];
    const existing = existingLocations[i];

    if (existing) {
      await prisma.location.update({
        where: { id: existing.id },
        data: {
          name: sucursal.name,
          address: sucursal.address,
          timezone: sucursal.timezone,
          latitude: sucursal.lat,
          longitude: sucursal.lng,
          isActive: true,
        },
      });
      console.log(`✓ Location #${i + 1} actualizada → ${sucursal.name}`);
    } else {
      await prisma.location.create({
        data: {
          tenantId: tenant.id,
          name: sucursal.name,
          address: sucursal.address,
          timezone: sucursal.timezone,
          latitude: sucursal.lat,
          longitude: sucursal.lng,
          isActive: true,
        },
      });
      console.log(`✓ Location #${i + 1} creada → ${sucursal.name}`);
    }
    console.log(`  Address:  ${sucursal.address}`);
    console.log(`  Timezone: ${sucursal.timezone}`);
    console.log(`  Lat/Lng:  ${sucursal.lat}, ${sucursal.lng}\n`);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('💥 Error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
