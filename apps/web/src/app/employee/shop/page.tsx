'use client';

// ============================================================
// Tienda del portal del EMPLEADO/FREELANCER.
// Replica la Tienda del panel admin (/shop) con las MISMAS 3 pestañas:
//   - Productos      → productos publicados en la tienda (ShopProductsTab).
//   - Pedidos        → apartados/reservaciones (ReservationsContent).
//   - Configuración  → ajustes de tienda (ShopSettingsContent).
// Reusa los componentes del dashboard, ajustando solo las rutas propias del
// portal del freelancer (inventario, calendario y punto de venta).
// ============================================================

import { useState } from 'react';
import { ReservationsContent } from '@/app/(dashboard)/reservations/reservations-content';
import { ShopSettingsContent } from '@/app/(dashboard)/settings/shop/shop-content';
import { ShopProductsTab } from '@/app/(dashboard)/shop/shop-products-tab';

type ShopTab = 'productos' | 'apartados' | 'configuracion';

const TABS: { key: ShopTab; label: string }[] = [
  { key: 'productos', label: 'Productos' },
  { key: 'apartados', label: 'Pedidos' },
  { key: 'configuracion', label: 'Configuración' },
];

export default function EmployeeShopPage() {
  const [activeTab, setActiveTab] = useState<ShopTab>('productos');

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="border-b border-gray-200 px-6 flex items-center gap-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#008080] text-[#008080]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'productos' && <ShopProductsTab inventoryHref="/employee/inventory" />}
        {activeTab === 'apartados' && (
          <ReservationsContent embedded calendarPath="/employee/appointments" posPath="/employee/pos" />
        )}
        {activeTab === 'configuracion' && <ShopSettingsContent />}
      </div>
    </div>
  );
}
