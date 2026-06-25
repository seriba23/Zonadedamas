// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/employee/subscription/page.tsx
// RUTA EN EL NAVEGADOR: /employee/subscription
//
// QUÉ HACE ESTA PÁGINA:
//   Muestra la pantalla de gestión de suscripción de la plataforma Siliba
//   dentro del portal del empleado. Aquí el freelancer puede:
//   - Ver su plan actual (PRO o PLUS).
//   - Hacer upgrade a un plan superior.
//   - Cancelar o reactivar su suscripción.
//   - Ver el historial de cobros y descargar facturas.
//
// A QUIÉN VA DIRIGIDA:
//   Principalmente a freelancers (profesionales independientes) que usan
//   Siliba como su plataforma personal. Ellos NO tienen acceso al panel
//   de administración, así que esta es su única forma de gestionar el plan.
//
// PATRÓN DE REUTILIZACIÓN:
//   Reutiliza exactamente el mismo componente de suscripción del panel de
//   administración. El componente SubscriptionContent usa Stripe Elements
//   para procesar pagos de forma segura.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

// ─── IMPORTACIÓN ─────────────────────────────────────────────────────────────
// SubscriptionContent: componente del panel de administración que muestra
// toda la interfaz de suscripción con Stripe. Al reutilizarlo aquí,
// el freelancer tiene exactamente la misma experiencia que un administrador.
// ─────────────────────────────────────────────────────────────────────────────
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
// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function EmployeeSubscriptionPage() {
  return (
    // Contenedor flex en columna que ocupa todo el alto disponible.
    // Mismo patrón que notifications y services: área con scroll interior.
    <div className="flex flex-col h-full">
      {/* Área con scroll vertical para que el contenido de suscripción
          (que puede ser largo: planes, historial, facturas) sea desplazable
          sin afectar el encabezado ni la barra de navegación del layout. */}
      <div className="flex-1 overflow-y-auto">
        {/* Componente de suscripción del admin.
            No necesita props adicionales: lee el tenantId del JWT y el
            estado de suscripción (Stripe) directamente desde el backend. */}
        <SubscriptionContent />
      </div>
    </div>
  );
}
