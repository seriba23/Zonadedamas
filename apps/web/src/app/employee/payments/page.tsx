'use client';

// ============================================================
// Métodos de pago del portal EMPLEADO/FREELANCER. Reusa el mismo
// <PaymentMethodsContent/> del dashboard. Independiente de la tienda: el
// freelancer puede aceptar tarjeta/SPEI sin activar su tienda, y estos
// métodos también alimentan el anticipo de citas.
// ============================================================

import { PaymentMethodsContent } from '@/components/settings/payment-methods-content';

export default function EmployeePaymentsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <PaymentMethodsContent />
    </div>
  );
}
