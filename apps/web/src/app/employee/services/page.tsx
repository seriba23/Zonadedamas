'use client';

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
export default function EmployeeServicesPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <ServicesContent />
      </div>
    </div>
  );
}
