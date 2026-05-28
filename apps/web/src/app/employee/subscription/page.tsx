'use client';

import SubscriptionContent from '@/app/(dashboard)/settings/subscription/page';

/**
 * /employee/subscription
 *
 * Suscripcion desde el portal empleado. Para freelancer (no entra al
 * admin) es la unica via para ver/cambiar su plan, cobros y facturas.
 *
 * Reusa la pagina admin tal cual: misma logica de Stripe Elements,
 * mismo backend, mismos botones de upgrade/cancelar/anual.
 */
export default function EmployeeSubscriptionPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <SubscriptionContent />
      </div>
    </div>
  );
}
