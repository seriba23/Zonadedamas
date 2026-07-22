// ─────────────────────────────────────────────────────────────────────────────
// sync-permissions.ts — MIGRACIÓN idempotente (datos, no esquema).
//
// Sincroniza la tabla `permissions` con la LISTA MAESTRA del código
// (ALL_PERMISSIONS de tenants.service.ts). Históricamente la BD quedó
// desincronizada: el código exige permisos que nunca se sembraron
// (appointments.remind, appointments.no_show, payments.void), por lo que
// endpoints como `mark-reminder-sent` daban 403 a TODOS —incluido el dueño—
// porque el permiso requerido no existía en ninguna fila.
//
// Este script:
//   1) Hace upsert de CADA permiso de la lista maestra → crea los faltantes.
//   2) Asigna TODOS los permisos existentes al rol `owner` de cada tenant
//      (el dueño/freelancer debe tener acceso total, como un admin).
//
// Ejecutar UNA vez tras desplegar (con XAMPP/MySQL arriba):
//   cd apps/api && npm run db:sync-perms
// Es idempotente: correrlo N veces deja el mismo estado.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Copia de la lista maestra ALL_PERMISSIONS (tenants.service.ts). Mantener en
// sincronía si allá se agregan permisos nuevos.
const ALL_PERMISSIONS: { module: string; action: string; description?: string }[] = [
  // Tenant & Settings
  { module: 'tenant', action: 'read' },
  { module: 'tenant', action: 'update' },
  // Locations
  { module: 'locations', action: 'read' },
  { module: 'locations', action: 'create' },
  { module: 'locations', action: 'update' },
  { module: 'locations', action: 'delete' },
  // Users
  { module: 'users', action: 'read' },
  { module: 'users', action: 'create' },
  { module: 'users', action: 'update' },
  { module: 'users', action: 'delete' },
  { module: 'users', action: 'manage' },
  // Roles
  { module: 'roles', action: 'read' },
  { module: 'roles', action: 'create' },
  { module: 'roles', action: 'update' },
  { module: 'roles', action: 'delete' },
  // Clients
  { module: 'clients', action: 'read' },
  { module: 'clients', action: 'create' },
  { module: 'clients', action: 'update' },
  { module: 'clients', action: 'delete' },
  // Services
  { module: 'services', action: 'read' },
  { module: 'services', action: 'create' },
  { module: 'services', action: 'update' },
  { module: 'services', action: 'delete' },
  // Employees
  { module: 'employees', action: 'read' },
  { module: 'employees', action: 'create' },
  { module: 'employees', action: 'update' },
  { module: 'employees', action: 'delete' },
  { module: 'employees', action: 'manage_schedule' },
  { module: 'employees', action: 'manage_time_off' },
  { module: 'employees', action: 'manage_services' },
  // Resources
  { module: 'resources', action: 'read' },
  { module: 'resources', action: 'create' },
  { module: 'resources', action: 'update' },
  { module: 'resources', action: 'delete' },
  // Availability
  { module: 'availability', action: 'read' },
  // Appointments
  { module: 'appointments', action: 'read' },
  { module: 'appointments', action: 'create' },
  { module: 'appointments', action: 'update' },
  { module: 'appointments', action: 'delete' },
  { module: 'appointments', action: 'reschedule' },
  { module: 'appointments', action: 'cancel' },
  { module: 'appointments', action: 'complete' },
  { module: 'appointments', action: 'no_show', description: 'Mark appointment as no-show' },
  { module: 'appointments', action: 'remind', description: 'Send appointment reminders' },
  // Payments
  { module: 'payments', action: 'read' },
  { module: 'payments', action: 'create' },
  { module: 'payments', action: 'refund' },
  { module: 'payments', action: 'void', description: 'Void payments' },
  // Reports
  { module: 'reports', action: 'read' },
  { module: 'reports', action: 'export' },
  // Audit
  { module: 'audit', action: 'read' },
  // Automation
  { module: 'automation', action: 'read' },
  { module: 'automation', action: 'manage' },
];

async function main() {
  // 1) Upsert de cada permiso maestro (crea los faltantes; no toca los existentes).
  let created = 0;
  for (const p of ALL_PERMISSIONS) {
    const before = await prisma.permission.findUnique({
      where: { module_action: { module: p.module, action: p.action } },
      select: { id: true },
    });
    await prisma.permission.upsert({
      where: { module_action: { module: p.module, action: p.action } },
      update: {},
      create: { module: p.module, action: p.action, description: p.description ?? null },
    });
    if (!before) {
      created++;
      console.log(`  + creado permiso ${p.module}.${p.action}`);
    }
  }
  console.log(`✔ Permisos maestros verificados. Creados nuevos: ${created}.`);

  // 2) Asignar TODOS los permisos existentes a cada rol `owner` (acceso total).
  const allPerms = await prisma.permission.findMany({ select: { id: true } });
  const allPermIds = allPerms.map((p) => p.id);

  const ownerRoles = await prisma.role.findMany({ where: { slug: 'owner' }, select: { id: true, tenantId: true } });
  let totalAssigned = 0;
  for (const role of ownerRoles) {
    const res = await prisma.rolePermission.createMany({
      data: allPermIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
    totalAssigned += res.count;
  }
  console.log(
    `✔ Rol owner sincronizado en ${ownerRoles.length} tenant(s). Filas nuevas role_permissions: ${totalAssigned}. ` +
      `Cada owner tiene ahora ${allPermIds.length} permisos.`,
  );
}

main()
  .then(() => console.log('✅ Sincronización de permisos completada.'))
  .catch((err) => {
    console.error('❌ Error en la sincronización:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
