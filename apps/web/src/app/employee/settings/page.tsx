'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useSearchParams } from 'next/navigation';
import { EmployeeSettingsContent } from './settings-content';
import { AppointmentSettingsContent } from '@/components/settings/appointment-settings-content';
import { EmployeeHomeServiceContent } from '@/components/settings/employee-home-service-content';
import { BrowserNotificationsToggle } from '@/components/settings/browser-notifications-toggle';
import { PaymentMethodsContent } from '@/components/settings/payment-methods-content';
import { DepositSettingsContent } from '@/components/settings/deposit-settings-content';
import { InstallAppContent } from '@/components/settings/install-app-content';
import { AccountSettingsContent } from '@/components/settings/account-settings-content';
import NotificationsContent from '@/app/(dashboard)/settings/notifications/page';
import BusinessContent from '@/app/(dashboard)/settings/business/page';
import QRContent from '@/app/(dashboard)/settings/qr/page';
import { useSectionHelpKey } from '@/lib/section-help-context';

type SettingsTab =
  | 'general'
  | 'negocio'
  | 'reserva'
  | 'domicilio'
  | 'pagos'
  | 'anticipo'
  | 'qr'
  | 'notificaciones'
  | 'app'
  | 'cuenta';

// Cada pestaña muestra su propia ayuda (ⓘ del header). Reutilizamos las mismas
// claves que la Configuración del panel admin para estandarizar el contenido.
const HELP_KEY_BY_TAB: Record<SettingsTab, string> = {
  general: 'emp-set-general',
  negocio: 'set-negocio',
  reserva: 'set-reserva',
  domicilio: 'emp-set-domicilio',
  pagos: 'set-ventas',
  anticipo: 'set-anticipo',
  qr: 'set-qr',
  notificaciones: 'emp-set-notif',
  app: 'set-app',
  cuenta: 'emp-set-cuenta',
};

// Pestañas EXCLUSIVAS del dueño del negocio (freelancer). Un empleado normal
// solo ve las básicas (General / Notificaciones / Cuenta).
const FREELANCER_ONLY: SettingsTab[] = ['negocio', 'reserva', 'domicilio', 'pagos', 'anticipo', 'qr'];

const COUNTRIES = [
  { code: 'MX', name: 'México' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'DO', name: 'República Dominicana' },
  { code: 'CO', name: 'Colombia' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'PE', name: 'Perú' },
  { code: 'ES', name: 'España' },
  { code: 'BR', name: 'Brasil' },
];

export default function EmployeeSettingsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState('es');
  const [country, setCountry] = useState('MX');
  // Solo el freelancer (dueño de su propio negocio) configura las secciones de
  // negocio: son las mismas que en el panel del administrador.
  const isFreelancer = (user as any)?.tenantType === 'FREELANCER';

  // Pestaña inicial: respeta ?tab=... o el atajo ?section=reserva; si no, General.
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const t = searchParams.get('tab') as SettingsTab | null;
    if (t && HELP_KEY_BY_TAB[t]) return t;
    if (searchParams.get('section') === 'reserva') return 'reserva';
    return 'general';
  });

  // Pestañas visibles, estandarizadas con la Configuración del panel admin
  // (mismo orden y contenido), más las propias del portal (General, A domicilio,
  // Cuenta). Las de negocio solo para el freelancer.
  const ALL_TABS: { key: SettingsTab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'negocio', label: 'Mi Negocio' },
    { key: 'reserva', label: 'Reserva' },
    { key: 'domicilio', label: 'A domicilio' },
    { key: 'pagos', label: 'Métodos de pago' },
    { key: 'anticipo', label: 'Anticipo' },
    { key: 'qr', label: 'Código QR' },
    { key: 'notificaciones', label: 'Notificaciones' },
    { key: 'app', label: 'Instalar app' },
    { key: 'cuenta', label: 'Cuenta' },
  ];
  const TABS = ALL_TABS.filter((t) => isFreelancer || !FREELANCER_ONLY.includes(t.key));

  // Si el usuario cae (por ?tab/?section) en una pestaña que no le corresponde,
  // lo mandamos a General.
  const currentTab: SettingsTab = TABS.some((t) => t.key === activeTab) ? activeTab : 'general';

  // El ⓘ del header explica la pestaña activa. (Se llama SIEMPRE, antes de
  // cualquier return, para no romper las reglas de hooks.)
  useSectionHelpKey(HELP_KEY_BY_TAB[currentTab]);

  // Sub-página "Editar perfil" a pantalla completa (patrón existente).
  if (searchParams.get('section') === 'profile') {
    return <EmployeeSettingsContent />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Barra de pestañas — mismo estilo que Configuración del panel. */}
      <div className="border-b border-gray-200 px-6 flex items-center gap-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              currentTab === tab.key
                ? 'border-[#008080] text-[#008080]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── General ── */}
        {currentTab === 'general' && (
          <div className="p-6 max-w-lg mx-auto pb-24 lg:pb-6 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              <div className="px-4 py-3">
                <p className="text-sm text-gray-900 mb-0.5">País</p>
                <p className="text-xs text-gray-400 mb-2">Afecta el formato de fechas y números</p>
                <select value={country} onChange={(e) => setCountry(e.target.value)} className="input-field">
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-gray-900 mb-0.5">Idioma</p>
                <p className="text-xs text-gray-400 mb-2">Idioma de la aplicación</p>
                <div className="flex gap-2">
                  {[{ key: 'es', label: 'Español' }, { key: 'en', label: 'English' }, { key: 'pt', label: 'Português' }].map((l) => (
                    <button key={l.key} onClick={() => setLanguage(l.key)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${language === l.key ? 'bg-[#008080] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Mi Negocio (solo freelancer) — mismo componente que el admin ── */}
        {currentTab === 'negocio' && isFreelancer && <BusinessContent />}

        {/* ── Reserva (solo freelancer) ── */}
        {currentTab === 'reserva' && isFreelancer && <AppointmentSettingsContent />}

        {/* ── A domicilio (solo freelancer) ── */}
        {currentTab === 'domicilio' && isFreelancer && <EmployeeHomeServiceContent />}

        {/* ── Métodos de pago (solo freelancer) — antes era item del menú ── */}
        {currentTab === 'pagos' && isFreelancer && <PaymentMethodsContent />}

        {/* ── Anticipo (solo freelancer) — antes era item del menú ── */}
        {currentTab === 'anticipo' && isFreelancer && <DepositSettingsContent />}

        {/* ── Código QR (solo freelancer) — mismo componente que el admin ── */}
        {currentTab === 'qr' && isFreelancer && <QRContent />}

        {/* ── Notificaciones ──
            - control real para activar las notificaciones push del navegador;
            - y, para el freelancer, la MISMA pantalla de plantillas de avisos a
              clientes que usa el administrador (Mensajes automáticos). */}
        {currentTab === 'notificaciones' && (
          <div className="pb-24 lg:pb-6">
            <div className="p-6 max-w-lg mx-auto">
              <BrowserNotificationsToggle />
            </div>
            {isFreelancer && <NotificationsContent />}
          </div>
        )}

        {/* ── Instalar app — mismo componente que el admin ── */}
        {currentTab === 'app' && <InstallAppContent />}

        {/* ── Cuenta ── (mismo componente estándar que el panel admin) */}
        {currentTab === 'cuenta' && <AccountSettingsContent />}
      </div>
    </div>
  );
}
