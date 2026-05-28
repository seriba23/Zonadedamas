'use client';

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
export default function EmployeeNotificationsPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <NotificationsContent />
      </div>
    </div>
  );
}
