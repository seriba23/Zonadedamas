'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { InventoryContent } from './inventory-content';
import { SuppliersContent } from '../suppliers/suppliers-content';
import { ResourcesContent } from '../resources/resources-content';

type InventoryPageTab = 'productos' | 'proveedores' | 'recursos';

const INVENTORY_PAGE_TABS: { key: InventoryPageTab; label: string }[] = [
  { key: 'productos', label: 'Productos' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'recursos', label: 'Recursos' },
];

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<InventoryPageTab>('productos');

  return (
    <div className="flex flex-col h-full">
      <Header title="Inventario" />

      <div className="border-b border-gray-200 px-6 flex items-center gap-6">
        {INVENTORY_PAGE_TABS.map((tab) => (
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
        {activeTab === 'productos' && <InventoryContent />}
        {activeTab === 'proveedores' && <SuppliersContent embedded />}
        {activeTab === 'recursos' && <ResourcesContent embedded />}
      </div>
    </div>
  );
}
