// ─── rewards/page.tsx — Recompensas del Empleado (Freelancer) ───────────
//
// Esta página está en /employee/rewards y permite al empleado freelancer
// gestionar sus cupones y recompensas de fidelidad.
//
// ¿POR QUÉ EXISTE ESTA PÁGINA?
// Un empleado normal (vinculado a un negocio) no gestiona cupones, eso lo
// hace el dueño del negocio desde el panel de administración.
// Sin embargo, un empleado FREELANCER (independiente) no tiene acceso al
// panel de administración, así que esta página actúa como su único punto
// de gestión de cupones/recompensas.
//
// REUTILIZACIÓN DE CÓDIGO:
// En lugar de duplicar la interfaz de recompensas, esta página importa y
// renderiza directamente el mismo componente que usa el panel admin.
// Esto garantiza que ambas interfaces se mantengan sincronizadas
// automáticamente cuando se hagan cambios al componente compartido.
//
// El patrón "composición sobre duplicación" es una buena práctica en React:
// preferimos reutilizar componentes existentes que copiar código.

'use client';
// 'use client' → necesario aunque no usemos hooks directamente aquí,
// porque RewardsContent sí los usa internamente.

import { RewardsContent } from '@/app/(dashboard)/rewards/rewards-content';
// RewardsContent → componente del panel de administración que maneja el CRUD
// completo de recompensas (crear, leer, actualizar, eliminar cupones).
// Al importarlo aquí, el empleado freelancer tiene la misma funcionalidad.

/**
 * /employee/rewards
 *
 * Cupones / recompensas desde el portal empleado. Para freelancer es su
 * unica via para crear cupones que puedan canjear sus clientes (no entra
 * al admin).
 *
 * Reusa RewardsContent del admin: mismo CRUD, mismos endpoints, mismos
 * permisos (rewards.create/read/update/delete) que el rol Owner del
 * freelancer tiene por default.
 */
export default function EmployeeRewardsPage() {
  return (
    // flex flex-col h-full → ocupa todo el alto disponible en el layout.
    <div className="flex flex-col h-full">
      {/* flex-1 → el área de contenido ocupa todo el espacio vertical.
          overflow-y-auto → permite scroll si el contenido es más alto que la pantalla. */}
      <div className="flex-1 overflow-y-auto">
        {/* Renderizamos directamente el componente compartido del admin.
            No pasamos props adicionales: el componente obtiene sus datos
            del contexto de autenticación (user.tenantId) internamente. */}
        <RewardsContent />
      </div>
    </div>
  );
}
