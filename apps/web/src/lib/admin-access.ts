// ─────────────────────────────────────────────────────────────────────────────
// admin-access.ts — FUENTE ÚNICA DE VERDAD de las secciones administrativas que
// un empleado puede tener concedidas (vía "Convertir en administrador").
//
// La usan:
//   - el sidebar de empleado (employee-sidebar.tsx): pinta un grupo "Administración"
//     con las secciones que el usuario tiene permiso de usar (color distinto).
//   - la guardia de ruta del árbol (dashboard) ((dashboard)/layout.tsx): impide
//     que un no-dueño entre por URL a una sección que no se le concedió.
//
// CRITERIO DEL PERMISO (`permission`): se elige un permiso que SOLO tenga quien
// realmente gestiona ese módulo, NO el rol base `staff`. Para módulos cuyo `.read`
// sigue en el set mínimo de staff (appointments/services/rewards) se usa una acción
// de escritura (update/create). `payments` usa `refund` e `inventory` usa `update`
// porque `posEnabled` inyecta `payments.read`/`inventory.read` como falsos positivos.
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminSection {
  key: string;        // = key de ADMIN_MODULES en employee-permissions.tsx
  label: string;
  href: string;       // ruta admin real bajo el árbol (dashboard)
  permission: string; // permiso "module.action" que gatea la sección
  icon: string;       // path SVG (heroicons outline)
}

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    key: 'appointments', label: 'Calendario', href: '/calendar', permission: 'appointments.update',
    icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  },
  {
    key: 'reminders', label: 'Recordatorios', href: '/reminders', permission: 'appointments.remind',
    icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  },
  {
    key: 'clients', label: 'Clientes', href: '/clients', permission: 'clients.read',
    icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  },
  {
    key: 'services', label: 'Servicios', href: '/services', permission: 'services.create',
    icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z',
  },
  {
    key: 'payments', label: 'Punto de Venta', href: '/pos', permission: 'payments.refund',
    icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
  },
  {
    key: 'employees', label: 'Personal', href: '/staff', permission: 'employees.read',
    icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  },
  {
    key: 'reports', label: 'Reportes', href: '/reports', permission: 'reports.read',
    icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  },
  {
    key: 'inventory', label: 'Inventario', href: '/inventory', permission: 'inventory.update',
    icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  },
  {
    key: 'rewards', label: 'Cupones', href: '/rewards', permission: 'rewards.create',
    icon: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z',
  },
  {
    key: 'resources', label: 'Recursos', href: '/resources', permission: 'resources.read',
    icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  },
  {
    key: 'locations', label: 'Sucursales', href: '/settings/locations', permission: 'locations.read',
    icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  },
];

// requiredPermissionForPath: dado un pathname del árbol (dashboard), devuelve el
// permiso de la sección admin que lo cubre (match por prefijo del href más largo),
// o null si no hay ninguna (p.ej. /home, /settings sin sub-ruta concedida).
export function requiredPermissionForPath(pathname: string): string | null {
  // Ordenamos por href más específico primero (/settings/locations antes que /settings).
  const match = [...ADMIN_SECTIONS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((s) => pathname === s.href || pathname.startsWith(s.href + '/'));
  return match ? match.permission : null;
}

// isDashboardPathAllowedForNonOwner: ¿puede un NO-dueño estar en este pathname del
// árbol (dashboard)? Solo si tiene el permiso de la sección que cubre esa ruta.
// Las rutas sin sección mapeada (/home, /settings, etc.) devuelven false → el
// guardia redirige al portal de empleado.
export function isDashboardPathAllowedForNonOwner(
  pathname: string,
  hasPermission: (p: string) => boolean,
): boolean {
  const required = requiredPermissionForPath(pathname);
  return required !== null && hasPermission(required);
}
