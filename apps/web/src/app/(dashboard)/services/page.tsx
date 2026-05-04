'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { ServicesContent } from './services-content';
import { BundlesContent } from '../bundles/bundles-content';
import { RewardsContent } from '../rewards/rewards-content';
import { PromotionsContent } from '../promotions/promotions-content';

type ServicePageTab = 'servicios' | 'paquetes' | 'cupones' | 'promociones';

const SERVICE_PAGE_TABS: { key: ServicePageTab; label: string }[] = [
  { key: 'servicios', label: 'Servicios' },
  { key: 'paquetes', label: 'Paquetes' },
  { key: 'cupones', label: 'Cupones' },
  { key: 'promociones', label: 'Promociones' },
];

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState<ServicePageTab>('servicios');

  return (
    <div className="flex flex-col h-full">
      <Header title="Servicios" />

      <div className="border-b border-gray-200 px-6 flex items-center gap-6">
        {SERVICE_PAGE_TABS.map((tab) => (
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
        {activeTab === 'servicios' && <ServicesContent />}
        {activeTab === 'paquetes' && <BundlesContent embedded />}
        {activeTab === 'cupones' && <RewardsContent embedded />}
        {activeTab === 'promociones' && <PromotionsContent embedded />}
      </div>
    </div>
  );
}
