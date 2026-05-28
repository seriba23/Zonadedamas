/**
 * Resetea avatarUrl y/o bio de un Employee para que el banner
 * "Completa tu perfil profesional" vuelva a aparecer (util en pruebas).
 *
 * Uso:
 *   npm run db:reset-employee-profile -- silvia@ibarra.com
 *     # vacia avatarUrl Y bio (banner aparece al 0/2)
 *
 *   npm run db:reset-employee-profile -- silvia@ibarra.com avatar
 *     # vacia solo avatarUrl (banner aparece al 1/2)
 *
 *   npm run db:reset-employee-profile -- silvia@ibarra.com bio
 *     # vacia solo bio (banner aparece al 1/2)
 *
 * El Employee se busca por su email (campo employees.email).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const which = (process.argv[3] || 'both').toLowerCase();

  if (!email) {
    console.error('Falta el email. Uso: npm run db:reset-employee-profile -- <email> [avatar|bio|both]');
    process.exit(1);
  }
  if (!['avatar', 'bio', 'both'].includes(which)) {
    console.error(`Argumento invalido: "${which}". Usa "avatar", "bio" o "both".`);
    process.exit(1);
  }

  const employee = await prisma.employee.findFirst({ where: { email } });
  if (!employee) {
    console.error(`No existe ningun Employee con email "${email}".`);
    process.exit(1);
  }

  const data: { avatarUrl?: null; bio?: null } = {};
  if (which === 'avatar' || which === 'both') data.avatarUrl = null;
  if (which === 'bio' || which === 'both') data.bio = null;

  await prisma.employee.update({
    where: { id: employee.id },
    data,
  });

  console.log(`OK - reset aplicado a ${email} (employee ${employee.id})`);
  console.log(`Campos vaciados: ${Object.keys(data).join(', ')}`);
  console.log(`Vuelve a iniciar sesion en /employee para ver el banner.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
