/**
 * Resetea la password de un usuario administrador.
 *
 * Uso:
 *   npm run db:reset-admin-password
 *   npm run db:reset-admin-password -- otro@email.com OtroPass123!
 *
 * Por defecto: admin@siliba.com / Admin123!
 *
 * El password se hashea con bcrypt rounds=12 (mismo que auth.service).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'admin@siliba.com';
  const newPassword = process.argv[3] || 'Admin123!';

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    console.error(`No existe ningun User con email "${email}".`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  console.log(`OK - password actualizada para ${email}`);
  console.log(`Nueva password: ${newPassword}`);
  console.log(`(guardada como hash bcrypt en users.password_hash)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
