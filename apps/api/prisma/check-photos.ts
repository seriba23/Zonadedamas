import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const slugs = ['bella-donna', 'barberkings', 'zen-spa', 'derma-plus', 'nails-factory',
    'corta-y-calla', 'glow-beauty', 'thai-harmony', 'clinica-renovar', 'rizos-and-co'];

  for (const slug of slugs) {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) continue;
    const emps = await prisma.employee.findMany({
      where: { tenantId: tenant.id },
      select: { firstName: true, lastName: true, avatarUrl: true },
    });
    console.log(`\n${tenant.name} (${slug}):`);
    for (const e of emps) {
      console.log(`  ${e.firstName} ${e.lastName}: ${e.avatarUrl || 'SIN FOTO'}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
