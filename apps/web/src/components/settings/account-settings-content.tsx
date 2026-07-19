'use client';

// ============================================================
// Pestaña "Cuenta" de Configuración — ESTÁNDAR compartido entre el panel del
// administrador y el portal del freelancer/empleado. Contiene:
//   - Editar perfil (nombre, foto, contacto, contraseña) → reutiliza el editor
//     genérico EmployeeSettingsContent en modo embebido.
//   - Ayuda y Legal (Centro de Ayuda, Aviso de Privacidad, Términos y Condiciones).
//   - Cerrar sesión.
// Así "Cuenta" luce y funciona igual en ambos portales.
// ============================================================

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/use-auth';
import { EmployeeSettingsContent } from '@/app/employee/settings/settings-content';

function ChevronRight() {
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

export function AccountSettingsContent() {
  const { logout } = useAuth();
  const [editingProfile, setEditingProfile] = useState(false);

  // Vista de edición de perfil (mismo editor genérico, embebido).
  if (editingProfile) {
    return (
      <div className="p-6 max-w-2xl mx-auto pb-24 lg:pb-6">
        <button
          onClick={() => setEditingProfile(false)}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Volver a Cuenta
        </button>
        <EmployeeSettingsContent embedded />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg mx-auto pb-24 lg:pb-6 space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <button
          onClick={() => setEditingProfile(true)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        >
          <div>
            <p className="text-sm text-gray-900">Editar perfil</p>
            <p className="text-xs text-gray-400">Nombre, foto, contacto, contraseña</p>
          </div>
          <ChevronRight />
        </button>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ayuda y Legal</p>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <Link href="/help" target="_blank" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
            <p className="text-sm text-gray-900">Centro de Ayuda</p>
            <ChevronRight />
          </Link>
          <Link href="/legal/privacy" target="_blank" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
            <p className="text-sm text-gray-900">Aviso de Privacidad</p>
            <ChevronRight />
          </Link>
          <Link href="/legal/terms" target="_blank" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
            <p className="text-sm text-gray-900">Términos y Condiciones</p>
            <ChevronRight />
          </Link>
        </div>
      </div>

      <button
        onClick={() => logout()}
        className="w-full py-3 rounded-xl text-sm font-medium text-red-600 bg-white border border-gray-200 hover:bg-red-50 transition-colors"
      >
        Cerrar sesión
      </button>

      <p className="text-center text-[10px] text-gray-300">Siliba v1.0</p>
    </div>
  );
}
