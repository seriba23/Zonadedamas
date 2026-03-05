import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLUGS = [
  'bella-donna', 'barberkings', 'zen-spa', 'derma-plus', 'nails-factory',
  'corta-y-calla', 'glow-beauty', 'thai-harmony', 'clinica-renovar', 'rizos-and-co',
];

async function main() {
  for (const slug of SLUGS) {
    const t = await prisma.tenant.findUnique({ where: { slug } });
    if (!t) continue;
    await prisma.tenant.update({ where: { id: t.id }, data: { logoUrl: null, coverImageUrl: null } });
    await prisma.tenantGalleryImage.deleteMany({ where: { tenantId: t.id } });
    await prisma.employee.updateMany({ where: { tenantId: t.id }, data: { avatarUrl: null } });
    console.log(`  Limpio: ${t.name}`);
  }
  console.log('\nDB limpia - ahora corre: npm run db:seed-photos');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
