/**
 * seed-platform-catalog.ts
 *
 * Popula los catalogos GLOBALES de la plataforma:
 *  - BusinessTypeCatalog (5 tipos)
 *  - Profession (11 profesiones)
 *  - ServiceCatalog (138 servicios por profesion)
 *
 * Estos datos son compartidos por TODOS los tenants. Se administran desde la
 * consola SuperAdmin en /platform/professions, /platform/service-catalog y
 * /platform/business-types.
 *
 * Idempotente: usa upsert por unique key.
 *
 * Uso: cd apps/api && npm run db:seed-platform-catalog
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BUSINESS_TYPES = [
  { value: 'SALON', label: 'Salón', sortOrder: 1 },
  { value: 'BARBERIA', label: 'Barbería', sortOrder: 2 },
  { value: 'SPA', label: 'SPA', sortOrder: 3 },
  { value: 'CLINICA', label: 'Clínica', sortOrder: 4 },
  { value: 'TATUAJES', label: 'Tatuajes', sortOrder: 5 },
];

const PROFESSIONS = [
  'Barbero/a',
  'Colorista',
  'Cosmetólogo/a',
  'Esteticista',
  'Estilista',
  'Manicurista',
  'Masajista',
  'Pedicurista',
  'Piercer',
  'Tatuador/a',
  'Terapeuta',
];

const SERVICE_CATALOG: Array<{ name: string; category: string }> = [
  { name: 'Afeitado tradicional con navaja', category: 'Barbero/a' },
  { name: 'Arreglo de bigote', category: 'Barbero/a' },
  { name: 'Corte de cabello clásico', category: 'Barbero/a' },
  { name: 'Corte degradado', category: 'Barbero/a' },
  { name: 'Corte moderno / fade', category: 'Barbero/a' },
  { name: 'Diseño de barba', category: 'Barbero/a' },
  { name: 'Exfoliación facial', category: 'Barbero/a' },
  { name: 'Lavado capilar', category: 'Barbero/a' },
  { name: 'Limpieza facial básica', category: 'Barbero/a' },
  { name: 'Perfilado de barba', category: 'Barbero/a' },
  { name: 'Rasurado de cabeza', category: 'Barbero/a' },
  { name: 'Tinte de barba', category: 'Barbero/a' },
  { name: 'Tinte de cabello masculino', category: 'Barbero/a' },
  { name: 'Balayage', category: 'Colorista' },
  { name: 'Corrección de color', category: 'Colorista' },
  { name: 'Decoloración', category: 'Colorista' },
  { name: 'Highlights', category: 'Colorista' },
  { name: 'Matización', category: 'Colorista' },
  { name: 'Mechas', category: 'Colorista' },
  { name: 'Retoque de raíz', category: 'Colorista' },
  { name: 'Tinte completo', category: 'Colorista' },
  { name: 'Tinte fantasía', category: 'Colorista' },
  { name: 'Depilación corporal con cera', category: 'Cosmetólogo/a' },
  { name: 'Depilación facial', category: 'Cosmetólogo/a' },
  { name: 'Dermapen (microneedling)', category: 'Cosmetólogo/a' },
  { name: 'Diseño de cejas', category: 'Cosmetólogo/a' },
  { name: 'Exfoliación facial', category: 'Cosmetólogo/a' },
  { name: 'Extensión de pestañas', category: 'Cosmetólogo/a' },
  { name: 'Facial antiacné', category: 'Cosmetólogo/a' },
  { name: 'Facial antiedad', category: 'Cosmetólogo/a' },
  { name: 'Facial hidratante', category: 'Cosmetólogo/a' },
  { name: 'Hidrafacial', category: 'Cosmetólogo/a' },
  { name: 'Laminado de cejas', category: 'Cosmetólogo/a' },
  { name: 'Lash lifting', category: 'Cosmetólogo/a' },
  { name: 'Limpieza facial básica', category: 'Cosmetólogo/a' },
  { name: 'Limpieza facial profunda', category: 'Cosmetólogo/a' },
  { name: 'Mascarillas especializadas', category: 'Cosmetólogo/a' },
  { name: 'Peeling superficial', category: 'Cosmetólogo/a' },
  { name: 'Radiofrecuencia facial', category: 'Cosmetólogo/a' },
  { name: 'Tinte de cejas', category: 'Cosmetólogo/a' },
  { name: 'Tratamientos reafirmantes faciales', category: 'Cosmetólogo/a' },
  { name: 'Cavitación', category: 'Esteticista' },
  { name: 'Depilación con cera', category: 'Esteticista' },
  { name: 'Depilación láser', category: 'Esteticista' },
  { name: 'Limpieza facial profunda', category: 'Esteticista' },
  { name: 'Maquillaje de novia', category: 'Esteticista' },
  { name: 'Maquillaje profesional', category: 'Esteticista' },
  { name: 'Microdermoabrasión', category: 'Esteticista' },
  { name: 'Radiofrecuencia corporal', category: 'Esteticista' },
  { name: 'Tratamiento antiacné', category: 'Esteticista' },
  { name: 'Tratamiento antiedad', category: 'Esteticista' },
  { name: 'Tratamiento reductor', category: 'Esteticista' },
  { name: 'Alaciado (keratina / japonés)', category: 'Estilista' },
  { name: 'Balayage', category: 'Estilista' },
  { name: 'Botox capilar', category: 'Estilista' },
  { name: 'Cepillado', category: 'Estilista' },
  { name: 'Corte de caballero', category: 'Estilista' },
  { name: 'Corte de dama', category: 'Estilista' },
  { name: 'Corte infantil', category: 'Estilista' },
  { name: 'Decoloración', category: 'Estilista' },
  { name: 'Hidratación capilar', category: 'Estilista' },
  { name: 'Highlights', category: 'Estilista' },
  { name: 'Matización', category: 'Estilista' },
  { name: 'Mechas', category: 'Estilista' },
  { name: 'Ondulado', category: 'Estilista' },
  { name: 'Peinado casual', category: 'Estilista' },
  { name: 'Peinado social / evento', category: 'Estilista' },
  { name: 'Permanente', category: 'Estilista' },
  { name: 'Planchado', category: 'Estilista' },
  { name: 'Reparación capilar', category: 'Estilista' },
  { name: 'Retoque de raíz', category: 'Estilista' },
  { name: 'Tinte completo', category: 'Estilista' },
  { name: 'Tratamiento capilar intensivo', category: 'Estilista' },
  { name: 'Diseño básico y avanzado', category: 'Manicurista' },
  { name: 'Esculpido de uñas', category: 'Manicurista' },
  { name: 'Esmalte tradicional', category: 'Manicurista' },
  { name: 'Gelish / semipermanente', category: 'Manicurista' },
  { name: 'Manicure', category: 'Manicurista' },
  { name: 'Manicure spa', category: 'Manicurista' },
  { name: 'Nail art', category: 'Manicurista' },
  { name: 'Pedicure', category: 'Manicurista' },
  { name: 'Pedicure spa', category: 'Manicurista' },
  { name: 'Relleno / retoque de uñas', category: 'Manicurista' },
  { name: 'Retiro de acrílico', category: 'Manicurista' },
  { name: 'Retiro de gel', category: 'Manicurista' },
  { name: 'Spa de manos', category: 'Manicurista' },
  { name: 'Spa de pies', category: 'Manicurista' },
  { name: 'Uñas acrílicas', category: 'Manicurista' },
  { name: 'Uñas de gel', category: 'Manicurista' },
  { name: 'Aromaterapia', category: 'Masajista' },
  { name: 'Drenaje linfático', category: 'Masajista' },
  { name: 'Envolturas corporales', category: 'Masajista' },
  { name: 'Exfoliación corporal', category: 'Masajista' },
  { name: 'Hidratación corporal', category: 'Masajista' },
  { name: 'Masaje anticelulitis', category: 'Masajista' },
  { name: 'Masaje con piedras calientes', category: 'Masajista' },
  { name: 'Masaje deportivo', category: 'Masajista' },
  { name: 'Masaje descontracturante', category: 'Masajista' },
  { name: 'Masaje reductivo', category: 'Masajista' },
  { name: 'Masaje relajante', category: 'Masajista' },
  { name: 'Ritual de spa', category: 'Masajista' },
  { name: 'Esmaltado de pies', category: 'Pedicurista' },
  { name: 'Exfoliación de pies', category: 'Pedicurista' },
  { name: 'Gelish en pies', category: 'Pedicurista' },
  { name: 'Hidratación de pies', category: 'Pedicurista' },
  { name: 'Pedicure clásico', category: 'Pedicurista' },
  { name: 'Pedicure medicinal', category: 'Pedicurista' },
  { name: 'Pedicure spa', category: 'Pedicurista' },
  { name: 'Tratamiento de callosidades', category: 'Pedicurista' },
  { name: 'Cambio de joyería', category: 'Piercer' },
  { name: 'Piercing de cartílago', category: 'Piercer' },
  { name: 'Piercing de ceja', category: 'Piercer' },
  { name: 'Piercing de labio', category: 'Piercer' },
  { name: 'Piercing de lengua', category: 'Piercer' },
  { name: 'Piercing de nariz', category: 'Piercer' },
  { name: 'Piercing de ombligo', category: 'Piercer' },
  { name: 'Piercing de oreja (lóbulo)', category: 'Piercer' },
  { name: 'Piercing industrial', category: 'Piercer' },
  { name: 'Acuarela', category: 'Tatuador/a' },
  { name: 'Asesoría de diseño', category: 'Tatuador/a' },
  { name: 'Blackwork', category: 'Tatuador/a' },
  { name: 'Cover-up (tapado de tatuajes)', category: 'Tatuador/a' },
  { name: 'Diseño de tatuaje personalizado', category: 'Tatuador/a' },
  { name: 'Micro tatuajes', category: 'Tatuador/a' },
  { name: 'Neotradicional', category: 'Tatuador/a' },
  { name: 'Realismo', category: 'Tatuador/a' },
  { name: 'Retoque de tatuajes', category: 'Tatuador/a' },
  { name: 'Tatuaje flash', category: 'Tatuador/a' },
  { name: 'Tatuaje personalizado', category: 'Tatuador/a' },
  { name: 'Tradicional', category: 'Tatuador/a' },
  { name: 'Aromaterapia terapéutica', category: 'Terapeuta' },
  { name: 'Reflexología podal', category: 'Terapeuta' },
  { name: 'Reiki', category: 'Terapeuta' },
  { name: 'Terapia con ventosas', category: 'Terapeuta' },
  { name: 'Terapia craneal', category: 'Terapeuta' },
  { name: 'Terapia de puntos gatillo', category: 'Terapeuta' },
  { name: 'Terapia de relajación', category: 'Terapeuta' },
  { name: 'Terapia descontracturante', category: 'Terapeuta' },
];

async function main() {
  console.log('📚 Seedeando catalogos globales de la plataforma\n');

  // ─── Business Types ───
  let btCreated = 0;
  let btUpdated = 0;
  for (const bt of BUSINESS_TYPES) {
    const existing = await prisma.businessTypeCatalog.findUnique({ where: { value: bt.value } });
    if (existing) {
      await prisma.businessTypeCatalog.update({
        where: { value: bt.value },
        data: { label: bt.label, sortOrder: bt.sortOrder, isActive: true },
      });
      btUpdated++;
    } else {
      await prisma.businessTypeCatalog.create({ data: { ...bt, isActive: true } });
      btCreated++;
    }
  }
  console.log(`✓ BusinessTypes: ${btCreated} creados, ${btUpdated} actualizados`);

  // ─── Professions ───
  let profCreated = 0;
  let profUpdated = 0;
  for (const name of PROFESSIONS) {
    const existing = await prisma.profession.findUnique({ where: { name } });
    if (existing) {
      await prisma.profession.update({
        where: { name },
        data: { isActive: true },
      });
      profUpdated++;
    } else {
      await prisma.profession.create({ data: { name, isActive: true } });
      profCreated++;
    }
  }
  console.log(`✓ Professions: ${profCreated} creadas, ${profUpdated} actualizadas`);

  // ─── ServiceCatalog ───
  let scCreated = 0;
  let scSkipped = 0;
  for (const svc of SERVICE_CATALOG) {
    const existing = await prisma.serviceCatalog.findFirst({
      where: { name: svc.name, category: svc.category },
    });
    if (existing) {
      scSkipped++;
    } else {
      await prisma.serviceCatalog.create({ data: { ...svc, isActive: true } });
      scCreated++;
    }
  }
  console.log(`✓ ServiceCatalog: ${scCreated} creados, ${scSkipped} ya existian`);

  console.log('\n📊 Totales en BD:');
  console.log(`   BusinessTypes:  ${await prisma.businessTypeCatalog.count()}`);
  console.log(`   Professions:    ${await prisma.profession.count()}`);
  console.log(`   ServiceCatalog: ${await prisma.serviceCatalog.count()}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('💥 Error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
