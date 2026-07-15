'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useSectionHelpKey } from '@/lib/section-help-context';

const BusinessContent = dynamic(() => import('./business/page'), { ssr: false });
const LocationsContent = dynamic(() => import('./locations/page'), { ssr: false });
const HoursContent = dynamic(() => import('./hours/page'), { ssr: false });
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
const AppointmentContent = dynamic(
  () => import('@/components/settings/appointment-settings-content').then((mod) => ({ default: mod.AppointmentSettingsContent })),
  { ssr: false },
);
const InstallAppContent = dynamic(
  () => import('@/components/settings/install-app-content').then((mod) => ({ default: mod.InstallAppContent })),
  { ssr: false },
);
// Mensajes automáticos (plantillas Email/WhatsApp por evento): reutiliza la
// página existente como contenido de pestaña. Es configuración, así que vive aquí.
const MessagesContent = dynamic(() => import('./notifications/page'), { ssr: false });

type SettingsTab = 'negocio' | 'sucursales' | 'horarios' | 'citas' | 'ventas' | 'anticipo' | 'invitaciones' | 'qr' | 'mensajes' | 'app';

// Cada pestaña muestra su propia ayuda (ⓘ del header) en vez de la genérica.
const HELP_KEY_BY_TAB: Record<SettingsTab, string> = {
  negocio: 'set-negocio',
  sucursales: 'set-sucursales',
  horarios: 'set-horarios',
  citas: 'set-reserva',
  invitaciones: 'set-invitaciones',
  qr: 'set-qr',
  ventas: 'set-ventas',
  anticipo: 'set-anticipo',
  mensajes: 'set-mensajes',
  app: 'set-app',
};

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'negocio', label: 'Mi Negocio' },
  { key: 'sucursales', label: 'Sucursales' },
  { key: 'horarios', label: 'Horarios' },
  { key: 'citas', label: 'Reserva' },
  { key: 'invitaciones', label: 'Invitaciones' },
  { key: 'qr', label: 'Código QR' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'anticipo', label: 'Anticipo' },
  { key: 'mensajes', label: 'Mensajes automáticos' },
  { key: 'app', label: 'Instalar app' },
];

export default function SettingsPage() {
  // Deep-link ?tab=suscripcion (desde el banner de prueba/suscripción u otros
  // atajos): abre esa pestaña directamente. Si no viene o no es válida, "negocio".
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as SettingsTab | null;
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    tabParam && TABS.some((t) => t.key === tabParam) ? tabParam : 'negocio',
  );
  // El ⓘ del header explica la pestaña activa (Mi Negocio / Sucursales / …).
  useSectionHelpKey(HELP_KEY_BY_TAB[activeTab]);

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
        {activeTab === 'citas' && <AppointmentContent />}
        {activeTab === 'ventas' && <ShopContent />}
        {activeTab === 'anticipo' && <DepositContent />}
        {activeTab === 'invitaciones' && <InviteCodesContent />}
        {activeTab === 'qr' && <QRContent />}
        {activeTab === 'mensajes' && <MessagesContent />}
        {activeTab === 'app' && <InstallAppContent />}
      </div>
    </div>
  );
}
