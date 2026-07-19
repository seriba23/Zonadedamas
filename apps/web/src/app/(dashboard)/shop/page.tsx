'use client';

import { useState } from 'react';
import { ReservationsContent } from '../reservations/reservations-content';
import { ShopSettingsContent } from '../settings/shop/shop-content';
import { ShopProductsTab } from './shop-products-tab';

type ShopTab = 'productos' | 'apartados' | 'configuracion';

const TABS: { key: ShopTab; label: string }[] = [
  { key: 'productos', label: 'Productos' },
  { key: 'apartados', label: 'Pedidos' },
  { key: 'configuracion', label: 'Configuración' },
];

export default function ShopPage() {
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
        {activeTab === 'productos' && <ShopProductsTab />}
        {activeTab === 'apartados' && <ReservationsContent embedded />}
        {activeTab === 'configuracion' && <ShopSettingsContent />}
      </div>
    </div>
  );
}
