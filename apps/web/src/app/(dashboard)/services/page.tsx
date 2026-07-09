'use client';

import { useState } from 'react';
import { ServicesContent } from './services-content';
import { BundlesContent } from '../bundles/bundles-content';
import { RewardsContent } from '../rewards/rewards-content';
import { useSectionHelpKey } from '@/lib/section-help-context';

// Tabs de la pagina /services. La pestaña "Promociones" se eliminó porque
// las promociones (incluyendo 2×1) ahora viven en Cupones (rewards) como
// type='TWO_FOR_ONE'. Ver rewards/rewards-content.tsx.
type ServicePageTab = 'servicios' | 'paquetes' | 'cupones';

const SERVICE_PAGE_TABS: { key: ServicePageTab; label: string }[] = [
  { key: 'servicios', label: 'Servicios' },
  { key: 'paquetes', label: 'Paquetes' },
  { key: 'cupones', label: 'Cupones' },
];

// Cada pestaña muestra la ayuda (ⓘ del header) correspondiente.
const HELP_KEY_BY_TAB: Record<ServicePageTab, string> = {
  servicios: 'services',
  paquetes: 'bundles',
  cupones: 'rewards',
};

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState<ServicePageTab>('servicios');
  // El ⓘ del header explica la pestaña activa (Servicios / Paquetes / Cupones).
  useSectionHelpKey(HELP_KEY_BY_TAB[activeTab]);

  return (
    <div className="flex flex-col h-full">

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
      </div>
    </div>
  );
}
