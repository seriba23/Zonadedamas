'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const BusinessContent = dynamic(() => import('./business/page'), { ssr: false });
const LocationsContent = dynamic(() => import('./locations/page'), { ssr: false });
const HoursContent = dynamic(() => import('./hours/page'), { ssr: false });
const SubscriptionContent = dynamic(() => import('./subscription/page'), { ssr: false });
const InviteCodesContent = dynamic(() => import('./invite-codes/page'), { ssr: false });
const QRContent = dynamic(() => import('./qr/page'), { ssr: false });
const ShopContent = dynamic(
  () => import('./shop/shop-content').then((mod) => ({ default: mod.ShopSettingsContent })),
  { ssr: false },
);
const DepositContent = dynamic(
  () => import('@/components/settings/deposit-settings-content').then((mod) => ({ default: mod.DepositSettingsContent })),
  { ssr: false },
);

type SettingsTab = 'negocio' | 'sucursales' | 'horarios' | 'ventas' | 'anticipo' | 'suscripcion' | 'invitaciones' | 'qr';

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'negocio', label: 'Mi Negocio' },
  { key: 'sucursales', label: 'Sucursales' },
  { key: 'horarios', label: 'Horarios' },
  { key: 'invitaciones', label: 'Invitaciones' },
  { key: 'qr', label: 'Código QR' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'anticipo', label: 'Anticipo' },
  { key: 'suscripcion', label: 'Suscripción' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('negocio');

  return (
    <div className="flex flex-col h-full">

      <div className="border-b border-gray-200 px-6 flex items-center gap-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
        {activeTab === 'negocio' && <BusinessContent />}
        {activeTab === 'sucursales' && <LocationsContent />}
        {activeTab === 'horarios' && <HoursContent />}
        {activeTab === 'ventas' && <ShopContent />}
        {activeTab === 'anticipo' && <DepositContent />}
        {activeTab === 'suscripcion' && <SubscriptionContent />}
        {activeTab === 'invitaciones' && <InviteCodesContent />}
        {activeTab === 'qr' && <QRContent />}
      </div>
    </div>
  );
}
