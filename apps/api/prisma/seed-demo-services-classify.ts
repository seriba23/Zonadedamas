/**
 * seed-demo-services-classify.ts
 *
 * Asigna a cada servicio del tenant Demo Salon su `category` (= profesion) y
 * `subcategory` (= nombre del servicio del catalogo global) acorde a su
 * nombre y descripcion. Solo afecta al tenant Demo Salon.
 *
 * Uso: cd apps/api && npm run db:seed-demo-services-classify
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapeo manual: nombre del servicio del tenant -> { category: profesion, subcategory: servicio del catalogo }
const MAPPING: Record<string, { category: string; subcategory: string }> = {
  'Corte de Cabello': { category: 'Estilista', subcategory: 'Corte de dama' },
  'Corte y Peinado': { category: 'Estilista', subcategory: 'Corte de dama' },
  'Depilación con Cera': { category: 'Esteticista', subcategory: 'Depilación con cera' },
  'Facial Profundo': { category: 'Esteticista', subcategory: 'Limpieza facial profunda' },
  'Limpieza Facial Profunda': { category: 'Esteticista', subcategory: 'Limpieza facial profunda' },
  'Manicure Clásica': { category: 'Manicurista', subcategory: 'Manicure' },
  'Manicure Clásico': { category: 'Manicurista', subcategory: 'Manicure' },
  'Masaje Relajante': { category: 'Masajista', subcategory: 'Masaje relajante' },
  'Pedicure Spa': { category: 'Manicurista', subcategory: 'Pedicure spa' },
  'Peinado y Brushing': { category: 'Estilista', subcategory: 'Cepillado' },
  'Tinte Completo': { category: 'Colorista', subcategory: 'Tinte completo' },
  'Tinte de Cabello': { category: 'Colorista', subcategory: 'Tinte completo' },
};

async function main() {
  console.log('🏷️  Clasificando servicios de Demo Salon\n');

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo-salon' } });
  if (!tenant) {
    console.error('❌ Tenant "demo-salon" no encontrado.');
    process.exit(1);
  }

  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, name: true, category: true, subcategory: true },
  });

  let updated = 0;
  let unmapped = 0;
  for (const svc of services) {
    const mapping = MAPPING[svc.name];
    if (!mapping) {
      console.log(`  ! Sin mapeo para "${svc.name}" — sin cambios`);
      unmapped++;
      continue;
    }

    // Verificar que la combinacion profesion + servicio exista en el catalogo global.
    const catalog = await prisma.serviceCatalog.findFirst({
      where: { name: mapping.subcategory, category: mapping.category, isActive: true },
    });
    if (!catalog) {
      console.log(`  ⚠️  Catalogo no encontrado para "${mapping.category} / ${mapping.subcategory}" — saltado`);
      unmapped++;
      continue;
    }

    await prisma.service.update({
      where: { id: svc.id },
      data: { category: mapping.category, subcategory: mapping.subcategory },
    });
    console.log(`  ✓ "${svc.name}" → ${mapping.category} / ${mapping.subcategory}`);
    updated++;
  }

  console.log(`\n📊 Resumen:`);
  console.log(`   Servicios actualizados: ${updated}`);
  console.log(`   Sin mapeo / saltados:   ${unmapped}`);
  console.log(`   Total revisados:        ${services.length}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('💥 Error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
