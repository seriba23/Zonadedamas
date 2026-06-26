'use client';

// ============================================================
// Inventario del portal del EMPLEADO/FREELANCER (gestión de productos).
// Reusa <InventoryContent/> del dashboard. Como ese componente inyecta su
// botón "Agregar producto" vía useRegisterTopbarAction (que necesita un
// TopbarActionProvider), envolvemos la página en su PROPIO provider y
// mostramos la acción en una barra de título local — sin tocar el layout
// del portal del empleado.
// ============================================================

import { InventoryContent } from '@/app/(dashboard)/inventory/inventory-content';
import {
  TopbarActionProvider,
  useTopbarAction,
} from '@/lib/hooks/use-topbar-action';

// Muestra la acción registrada (ej. el botón "Agregar producto") en la barra.
function HeaderAction() {
  const action = useTopbarAction();
  return action ? <div>{action}</div> : null;
}

export default function EmployeeInventoryPage() {
  return (
    <TopbarActionProvider>
      <div className="flex flex-col h-full">
        <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <h1 className="text-base font-semibold text-gray-900">Inventario</h1>
          <HeaderAction />
        </div>
        <div className="flex-1 overflow-y-auto">
          <InventoryContent />
        </div>
      </div>
    </TopbarActionProvider>
  );
}
