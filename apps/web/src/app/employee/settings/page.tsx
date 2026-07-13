'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { EmployeeSettingsContent } from './settings-content';
import { AppointmentSettingsContent } from '@/components/settings/appointment-settings-content';
import { EmployeeHomeServiceContent } from '@/components/settings/employee-home-service-content';
import { useSectionHelpKey } from '@/lib/section-help-context';

// Cada pestaña muestra su propia ayuda (ⓘ del header).
const HELP_KEY_BY_TAB: Record<SettingsTab, string> = {
  general: 'emp-set-general',
  notificaciones: 'emp-set-notif',
  reserva: 'set-reserva', // mismo contenido que la pestaña Reserva del panel.
  domicilio: 'emp-set-domicilio',
  cuenta: 'emp-set-cuenta',
};

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

type SettingsTab = 'general' | 'notificaciones' | 'reserva' | 'domicilio' | 'cuenta';

export default function EmployeeSettingsPage() {
  const { logout, user } = useAuth();
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState('es');
  const [country, setCountry] = useState('MX');
  // Solo el freelancer configura la política de reserva de SU negocio.
  const isFreelancer = (user as any)?.tenantType === 'FREELANCER';

  // Pestaña inicial: respeta ?tab=... o el atajo ?section=reserva; si no, General.
  // (Se calcula con un inicializador perezoso para no romper las reglas de hooks.)
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const t = searchParams.get('tab');
    if (t && ['general', 'notificaciones', 'reserva', 'domicilio', 'cuenta'].includes(t)) {
      return t as SettingsTab;
    }
    if (searchParams.get('section') === 'reserva') return 'reserva';
    return 'general';
  });
  // El ⓘ del header explica la pestaña activa.
  useSectionHelpKey(HELP_KEY_BY_TAB[activeTab]);

  // Sub-página "Editar perfil" a pantalla completa (patrón existente).
  if (searchParams.get('section') === 'profile') {
    return <EmployeeSettingsContent />;
  }

  // Pestañas: "Reserva" solo para el freelancer (config de su propio negocio).
  const TABS: { key: SettingsTab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'notificaciones', label: 'Notificaciones' },
    ...(isFreelancer
      ? [
          { key: 'reserva' as const, label: 'Reserva' },
          { key: 'domicilio' as const, label: 'A domicilio' },
        ]
      : []),
    { key: 'cuenta', label: 'Cuenta' },
  ];
  // Si un no-freelancer cae en una pestaña de negocio (por ?tab/?section), lo
  // mandamos a General.
  const currentTab: SettingsTab =
    (activeTab === 'reserva' || activeTab === 'domicilio') && !isFreelancer
      ? 'general'
      : activeTab;

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

        {/* ── Notificaciones ── */}
        {currentTab === 'notificaciones' && (
          <div className="p-6 max-w-lg mx-auto pb-24 lg:pb-6">
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {[
                { label: 'Recordatorios de citas', desc: 'Antes y después de tus citas' },
                { label: 'Ofertas y promociones', desc: 'Descuentos de negocios que visitas' },
                { label: 'Puntos y recompensas', desc: 'Cuando ganas o puedes canjear puntos' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                  <div className="relative">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-[#008080] transition-colors cursor-pointer" onClick={(e) => { const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement; input.checked = !input.checked; }} />
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5 pointer-events-none" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Reserva (solo freelancer) ── */}
        {currentTab === 'reserva' && isFreelancer && <AppointmentSettingsContent />}

        {/* ── A domicilio (solo freelancer) ── */}
        {currentTab === 'domicilio' && isFreelancer && <EmployeeHomeServiceContent />}

        {/* ── Cuenta ── */}
        {currentTab === 'cuenta' && (
          <div className="p-6 max-w-lg mx-auto pb-24 lg:pb-6 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              <Link href="/employee/settings?section=profile" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm text-gray-900">Editar perfil</p>
                  <p className="text-xs text-gray-400">Nombre, foto, contacto, contraseña</p>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </Link>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ayuda y Legal</p>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                <Link href="/help" target="_blank" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <p className="text-sm text-gray-900">Centro de Ayuda</p>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </Link>
                <Link href="/legal/privacy" target="_blank" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <p className="text-sm text-gray-900">Aviso de Privacidad</p>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </Link>
                <Link href="/legal/terms" target="_blank" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <p className="text-sm text-gray-900">Términos y Condiciones</p>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </Link>
              </div>
            </div>

            <button onClick={() => logout()} className="w-full py-3 rounded-xl text-sm font-medium text-red-600 bg-white border border-gray-200 hover:bg-red-50 transition-colors">
              Cerrar sesión
            </button>

            <p className="text-center text-[10px] text-gray-300">Siliba v1.0</p>
          </div>
        )}
      </div>
    </div>
  );
}
