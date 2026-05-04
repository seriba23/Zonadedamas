'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { EmployeeSettingsContent } from './settings-content';

const COUNTRIES = [
  { code: 'MX', name: 'México', currency: 'MXN' },
  { code: 'US', name: 'Estados Unidos', currency: 'USD' },
  { code: 'DO', name: 'República Dominicana', currency: 'DOP' },
  { code: 'CO', name: 'Colombia', currency: 'COP' },
  { code: 'AR', name: 'Argentina', currency: 'ARS' },
  { code: 'CL', name: 'Chile', currency: 'CLP' },
  { code: 'PE', name: 'Perú', currency: 'PEN' },
  { code: 'ES', name: 'España', currency: 'EUR' },
  { code: 'BR', name: 'Brasil', currency: 'BRL' },
];

export default function EmployeeSettingsPage() {
  const { logout } = useAuth();
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState('es');
  const [currency, setCurrency] = useState('MXN');
  const [country, setCountry] = useState('MX');

  if (searchParams.get('section') === 'profile') {
    return <EmployeeSettingsContent />;
  }

  return (
    <div className="p-6 max-w-lg mx-auto pb-24 lg:pb-6">
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Configuración</h1>

      <div className="space-y-6">
        {/* General */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">General</p>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div className="px-4 py-3">
              <p className="text-sm text-gray-900 mb-0.5">País</p>
              <p className="text-xs text-gray-400 mb-2">Afecta moneda y formato</p>
              <select value={country} onChange={(e) => { setCountry(e.target.value); const c = COUNTRIES.find((c) => c.code === e.target.value); if (c) setCurrency(c.currency); }} className="input-field">
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
            <div className="px-4 py-3">
              <p className="text-sm text-gray-900 mb-0.5">Moneda</p>
              <p className="text-xs text-gray-400 mb-2">Cómo ver los precios</p>
              <div className="flex gap-2">
                {[
                  { key: COUNTRIES.find((c) => c.code === country)?.currency || 'MXN', label: COUNTRIES.find((c) => c.code === country)?.currency || 'MXN' },
                  { key: 'USD', label: 'USD' },
                ].map((m) => (
                  <button key={m.key} onClick={() => setCurrency(m.key)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${currency === m.key ? 'bg-[#008080] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Notificaciones</p>
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

        {/* Account */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Cuenta</p>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <Link href="/employee/settings?section=profile" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
              <div>
                <p className="text-sm text-gray-900">Editar perfil</p>
                <p className="text-xs text-gray-400">Nombre, foto, contacto, contraseña</p>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </Link>
          </div>
        </div>

        {/* Help & Legal */}
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

        {/* Logout */}
        <button onClick={() => logout()} className="w-full py-3 rounded-xl text-sm font-medium text-red-600 bg-white border border-gray-200 hover:bg-red-50 transition-colors">
          Cerrar sesión
        </button>

        <p className="text-center text-[10px] text-gray-300">Siliba v1.0</p>
      </div>
    </div>
  );
}
