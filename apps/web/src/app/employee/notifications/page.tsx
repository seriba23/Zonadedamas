// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/employee/notifications/page.tsx
// RUTA EN EL NAVEGADOR: /employee/notifications
//
// QUÉ HACE ESTA PÁGINA:
//   Muestra la pantalla de configuración de notificaciones para el empleado.
//   Aquí el empleado (o freelancer) puede configurar qué avisos automáticos
//   se envían a sus clientes: confirmación de cita, recordatorio, solicitud
//   de reseña, etc.
//
// PATRÓN DE REUTILIZACIÓN:
//   En lugar de crear un componente desde cero, esta página REUTILIZA
//   exactamente la misma pantalla que usa el panel de administración
//   (dashboard). Esto ahorra código y garantiza que ambas interfaces
//   tengan el mismo comportamiento.
//
//   El componente "NotificationsContent" ya tiene toda la lógica:
//   - Llamadas al API para cargar las plantillas de notificaciones
//   - Formularios para editarlas
//   - Botones para guardar
//   Nosotros simplemente lo colocamos dentro de un contenedor con scroll.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

// ─── IMPORTACIÓN ─────────────────────────────────────────────────────────────
// Importamos el componente NotificationsContent desde la sección del
// dashboard de administración. El paréntesis en "(dashboard)" es una
// convención de Next.js llamada "Route Group": agrupa carpetas sin que
// el nombre de la carpeta aparezca en la URL.
// Es decir, "(dashboard)/settings/notifications/page" → ruta /settings/notifications
// pero NO /dashboard/settings/notifications.
// ─────────────────────────────────────────────────────────────────────────────
import NotificationsContent from '@/app/(dashboard)/settings/notifications/page';

/**
 * /employee/notifications
 *
 * Notificaciones (templates + canales) desde el portal empleado. Para
 * freelancer es su unica via para configurar avisos de confirmacion,
 * recordatorio y reseña a clientes.
 *
 * Reusa la pagina admin tal cual.
 */
// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
// Esta función es el componente que Next.js renderiza en /employee/notifications.
// ─────────────────────────────────────────────────────────────────────────────
export default function EmployeeNotificationsPage() {
  return (
    // Contenedor principal: ocupa todo el alto disponible ("h-full") y
    // organiza sus hijos en columna vertical ("flex flex-col").
    <div className="flex flex-col h-full">
      {/* Contenedor interior con scroll vertical:
          - "flex-1" → ocupa todo el espacio sobrante de la columna flex.
          - "overflow-y-auto" → si el contenido es más alto que la pantalla,
            aparece una barra de scroll vertical automáticamente.
          Esto evita que la página entera de la app haga scroll; sólo
          este área interior lo hace. */}
      <div className="flex-1 overflow-y-auto">
        {/* Renderizamos el componente de notificaciones del admin.
            No necesita props (propiedades) porque lee el contexto del
            usuario desde el JWT y el tenantId automáticamente. */}
        <NotificationsContent />
      </div>
    </div>
  );
}
