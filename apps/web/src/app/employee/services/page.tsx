// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/employee/services/page.tsx
// RUTA EN EL NAVEGADOR: /employee/services
//
// QUÉ HACE ESTA PÁGINA:
//   Muestra el catálogo de servicios del negocio dentro del portal del
//   empleado. Aquí el empleado (o freelancer) puede ver, crear, editar
//   y eliminar servicios según sus permisos.
//
//   Ejemplos de servicios: "Corte de cabello", "Manicure francesa",
//   "Masaje relajante", cada uno con precio, duración, etc.
//
// PATRÓN DE REUTILIZACIÓN:
//   Al igual que la página de notificaciones, esta página reutiliza el
//   componente ServicesContent del panel de administración (dashboard).
//   No hay lógica duplicada: ambos portales usan exactamente el mismo
//   componente.
//
// PERMISOS Y SEGURIDAD:
//   Los permisos NO se comprueban aquí en el frontend. El backend (NestJS)
//   verifica automáticamente si el usuario tiene permiso "services.read",
//   "services.create", etc. antes de responder a cualquier petición.
//   Un freelancer con rol "Owner" tiene todos los permisos de servicios.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

// ─── IMPORTACIÓN ─────────────────────────────────────────────────────────────
// ServicesContent: componente del panel de administración que muestra
// la lista de servicios con búsqueda, filtros, botón de crear, etc.
// Al importarlo desde "(dashboard)", lo reutilizamos sin reescribirlo.
// ─────────────────────────────────────────────────────────────────────────────
import { ServicesContent } from '@/app/(dashboard)/services/services-content';

/**
 * /employee/services
 *
 * Servicios desde el portal empleado. Para freelancer es su unica via
 * de gestion (no entra al admin). Para empleados con permiso services.*
 * tambien funciona como atajo.
 *
 * Reusa el mismo componente ServicesContent del admin: filtra por
 * tenantId del JWT, no necesita logica nueva. Permisos los maneja el
 * backend (rol Owner del freelancer tiene services.create/update/delete).
 */
// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function EmployeeServicesPage() {
  return (
    // Contenedor flex en columna que ocupa todo el alto disponible.
    // "h-full" → hereda la altura del contenedor padre (el layout del empleado).
    // "flex flex-col" → los hijos se apilan verticalmente.
    <div className="flex flex-col h-full">
      {/* Área con scroll:
          - "flex-1" → ocupa todo el espacio vertical sobrante dentro del flex.
          - "overflow-y-auto" → habilita scroll vertical si el contenido lo requiere.
          Así, el encabezado y la barra de navegación quedan fijos y sólo
          esta sección central hace scroll. */}
      <div className="flex-1 overflow-y-auto">
        {/* Componente de servicios del admin. No recibe props porque
            lee el tenantId directamente del JWT (token de sesión) que
            el hook useAuth() proporciona internamente. */}
        <ServicesContent />
      </div>
    </div>
  );
}
