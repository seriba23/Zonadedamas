// Uso: node scripts/set-creator-password.js <email> <password>
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || '').toLowerCase().trim();
  const password = process.argv[3] || '';
  if (!email || !password) {
    console.error('Faltan argumentos: <email> <password>');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  const updated = await prisma.influencer.update({
    where: { email },
    data: { passwordHash: hash, inviteToken: null, inviteTokenExpiresAt: null },
    select: { email: true, firstName: true, lastName: true, status: true },
  });
  console.log('Contraseña actualizada para:', updated);
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
