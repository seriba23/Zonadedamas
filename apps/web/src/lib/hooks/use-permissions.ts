// ============================================================
// ARCHIVO: use-permissions.ts
// PROPÓSITO: Ofrece funciones para verificar si el usuario logueado
//            tiene ciertos permisos antes de mostrar botones, páginas
//            o secciones de la interfaz.
//
// CONTEXTO DE PERMISOS EN SILIBA:
//   Cada usuario tiene un rol (Dueño, Admin, Empleado, etc.) y ese rol
//   tiene una lista de permisos. Cada permiso es una string con formato
//   "modulo.accion", por ejemplo:
//     - "appointments.create"  → puede crear citas
//     - "staff.read"           → puede ver la lista del personal
//     - "reports.export"       → puede exportar reportes
//
//   El usuario logueado tiene un array de permisos: user.permissions.
//   Este hook facilita verificar si un permiso está en ese array.
//
// PATRÓN: Este es un hook "thin" (delgado): no tiene estado propio,
//         simplemente lee el estado de useAuth() y expone funciones
//         de consulta. Es muy común en proyectos grandes para mantener
//         la lógica de autorización centralizada y reutilizable.
// ============================================================

'use client';
// Solo corre en el navegador

import { useAuth } from './use-auth';
// useAuth: accedemos al usuario logueado para leer sus permisos

// ============================================================
// INTERFAZ: PermissionsHook
// Define exactamente qué devuelve el hook usePermissions().
// ============================================================
interface PermissionsHook {
  hasPermission: (permission: string) => boolean;
  // hasPermission("appointments.create") → true si el usuario puede crear citas

  hasAnyPermission: (perms: string[]) => boolean;
  // hasAnyPermission(["staff.read", "staff.manage"]) → true si tiene AL MENOS UNO

  hasAllPermissions: (perms: string[]) => boolean;
  // hasAllPermissions(["reports.read", "reports.export"]) → true solo si tiene TODOS

  permissions: string[];
  // La lista completa de permisos del usuario actual
  // Útil si quieres iterar sobre ellos o pasarlos a otro componente
}

// ============================================================
// HOOK: usePermissions
// No recibe parámetros.
// Devuelve: PermissionsHook con las 3 funciones de verificación + la lista
//
// Ejemplo de uso en un componente:
//   const { hasPermission } = usePermissions();
//   if (hasPermission('appointments.delete')) {
//     // mostrar botón "Eliminar cita"
//   }
// ============================================================
export function usePermissions(): PermissionsHook {
  const { user } = useAuth();
  // user?.permissions: si user es null (no logueado), devuelve undefined
  // || []: si undefined, usa array vacío (sin permisos = sin acceso a nada)
  const permissions = user?.permissions || [];
  // permissions ahora es siempre un array de strings (puede estar vacío)

  // ============================================================
  // hasPermission: verifica si un único permiso está en la lista.
  //
  // Array.includes(value): devuelve true si value existe en el array.
  //   permissions.includes("appointments.create")
  //   → true si "appointments.create" está en el array de permisos del usuario
  //
  // Es una ARROW FUNCTION (función flecha): forma corta de escribir funciones.
  //   const fn = (x) => x + 1  equivale a  function fn(x) { return x + 1; }
  // ============================================================
  const hasPermission = (permission: string): boolean =>
    permissions.includes(permission);

  // ============================================================
  // hasAnyPermission: verifica si el usuario tiene AL MENOS UNO de los permisos.
  //
  // Array.some(callback): recorre el array y devuelve true en cuanto
  // el callback devuelve true para algún elemento. Para en el primero que encuentra.
  //
  // perms.some((p) => permissions.includes(p)):
  //   Para cada permiso p en la lista perms, verifica si está en permissions.
  //   Devuelve true si ALGUNO de ellos está incluido.
  //
  // Ejemplo:
  //   hasAnyPermission(["staff.read", "staff.manage"])
  //   Si el usuario tiene "staff.read" pero no "staff.manage" → devuelve true
  //   Si el usuario no tiene ninguno de los dos → devuelve false
  // ============================================================
  const hasAnyPermission = (perms: string[]): boolean =>
    perms.some((p) => permissions.includes(p));
  // "p" es la variable iteradora del .some(): representa cada elemento del array perms

  // ============================================================
  // hasAllPermissions: verifica si el usuario tiene TODOS los permisos.
  //
  // Array.every(callback): recorre el array y devuelve true solo si
  // el callback devuelve true para TODOS los elementos.
  // Si alguno falla, devuelve false inmediatamente.
  //
  // perms.every((p) => permissions.includes(p)):
  //   Para cada permiso p en la lista perms, verifica si está en permissions.
  //   Devuelve true solo si TODOS están incluidos.
  //
  // Ejemplo:
  //   hasAllPermissions(["reports.read", "reports.export"])
  //   El usuario necesita AMBOS permisos. Si le falta uno → false
  // ============================================================
  const hasAllPermissions = (perms: string[]): boolean =>
    perms.every((p) => permissions.includes(p));
  // "p" es la variable iteradora del .every()

  // Devolvemos el objeto con las 3 funciones y la lista de permisos
  return { hasPermission, hasAnyPermission, hasAllPermissions, permissions };
}
