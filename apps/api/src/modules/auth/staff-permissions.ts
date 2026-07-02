// ─────────────────────────────────────────────────────────────────────────────
// STAFF_MINIMAL_PERMISSIONS — conjunto MÍNIMO de permisos del rol base "staff".
//
// Antes, el rol staff se creaba con TODOS los permisos de acción "read" de todos
// los módulos, lo que hacía que cualquier empleado viera secciones admin que no
// se le habían concedido (el sidebar decide visibilidad por ".read"). Ahora staff
// solo recibe los permisos que el propio PORTAL DE EMPLEADO necesita para
// funcionar (verificado auditando las llamadas de /employee/* contra los
// @RequirePermissions del backend):
//
//   - appointments.read     → Mis Citas, Inicio, Comisiones, detalle de cita
//   - appointments.complete → wizard de cierre de cita (record-payment/complete/…)
//   - services.read         → página nativa /employee/services (ServicesContent)
//   - rewards.read          → página nativa /employee/rewards (RewardsContent)
//
// El acceso admin real se concede aparte vía el rol "Ayudante" (helper) en
// grantAdminAccess. Esta constante es la ÚNICA fuente de verdad: la usan tanto el
// alta por invitación (registerWithInviteCode) como el script de migración
// (prisma/scripts/reset-staff-permissions.ts).
// ─────────────────────────────────────────────────────────────────────────────

export interface PermissionRef {
  module: string;
  action: string;
}

export const STAFF_MINIMAL_PERMISSIONS: PermissionRef[] = [
  { module: 'appointments', action: 'read' },
  { module: 'appointments', action: 'complete' },
  { module: 'services', action: 'read' },
  { module: 'rewards', action: 'read' },
];
