// ─────────────────────────────────────────────────────────────────────────────
// reset-staff-permissions.ts — MIGRACIÓN idempotente (datos, no esquema).
//
// Reajusta los roles `staff` YA existentes (uno por tenant) al nuevo conjunto
// mínimo de permisos (STAFF_MINIMAL_PERMISSIONS), corrigiendo el estado heredado
// en el que staff tenía TODOS los ".read". También asegura que el permiso nuevo
// `appointments.remind` exista y lo conserven los roles que ya gestionan citas
// (owner/manager/recepción), para no perder su acceso a Recordatorios.
//
// Ejecutar UNA vez tras desplegar el código nuevo:
//   cd apps/api && npm run db:reset-staff-perms
// Es idempotente: correrlo N veces deja el mismo estado. NO toca el rol
// "Ayudante" (helper), que se regenera al reasignar módulos de administración.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { STAFF_MINIMAL_PERMISSIONS } from '../src/modules/auth/staff-permissions';

const prisma = new PrismaClient();

async function main() {
  // 1) Asegurar que existe el permiso appointments.remind (Recordatorios).
  const remind = await prisma.permission.upsert({
    where: { module_action: { module: 'appointments', action: 'remind' } },
    update: {},
    create: {
      module: 'appointments',
      action: 'remind',
      description: 'Send appointment reminders',
    },
  });

  // 2) Dárselo a TODO rol que ya gestione citas (los que tienen
  //    appointments.update: owner, manager, recepción...). Así no pierden acceso
  //    a Recordatorios al separarlo de Calendario. Enfoque slug-agnóstico.
  const updatePerm = await prisma.permission.findUnique({
    where: { module_action: { module: 'appointments', action: 'update' } },
  });
  if (updatePerm) {
    const managerRolePerms = await prisma.rolePermission.findMany({
      where: { permissionId: updatePerm.id },
      select: { roleId: true },
    });
    const managerRoleIds = [...new Set(managerRolePerms.map((rp) => rp.roleId))];
    if (managerRoleIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: managerRoleIds.map((roleId) => ({ roleId, permissionId: remind.id })),
        skipDuplicates: true,
      });
    }
    console.log(`✔ appointments.remind asignado a ${managerRoleIds.length} rol(es) gestor(es).`);
  }

  // 3) Resolver los ids del set mínimo de staff (Permission es global).
  const minimalPerms = await prisma.permission.findMany({
    where: { OR: [...STAFF_MINIMAL_PERMISSIONS] },
  });
  const minimalIds = minimalPerms.map((p) => p.id);
  if (minimalIds.length !== STAFF_MINIMAL_PERMISSIONS.length) {
    console.warn(
      `⚠ Se esperaban ${STAFF_MINIMAL_PERMISSIONS.length} permisos mínimos pero se encontraron ${minimalIds.length}. ` +
        'Revisa que el catálogo de permisos esté sembrado.',
    );
  }

  // 4) Resetear cada rol staff (por-tenant) al set mínimo.
  const staffRoles = await prisma.role.findMany({ where: { slug: 'staff' } });
  for (const role of staffRoles) {
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (minimalIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: minimalIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`✔ Reseteados ${staffRoles.length} rol(es) staff a ${minimalIds.length} permiso(s) mínimos.`);
}

main()
  .then(() => console.log('✅ Migración completada.'))
  .catch((err) => {
    console.error('❌ Error en la migración:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
