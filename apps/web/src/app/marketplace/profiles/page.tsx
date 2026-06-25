// ============================================================
// PÁGINA: Selector de perfiles (estilo Netflix)
// RUTA:   /marketplace/profiles
//
// Se muestra tras iniciar sesión. El usuario (tutor) elige bajo qué perfil
// quiere operar: el suyo o el de un hijo/familiar a su cargo. Cada perfil
// tiene sus propias citas, puntos e historial. También puede crear perfiles.
// ============================================================
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMarketplaceAuth, MarketplaceProfile } from '@/lib/hooks/use-marketplace-auth';
import { marketplaceApi } from '@/lib/marketplace-api';

const TEAL = '#008080';

// Iniciales para el avatar cuando no hay foto (primera letra de nombre+apellido).
function initials(p: { firstName: string; lastName: string }) {
  return `${p.firstName?.[0] || ''}${p.lastName?.[0] || ''}`.toUpperCase();
}

export default function ProfilesSelectorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Si vinimos de un enlace protegido, ?redirect= trae a dónde volver tras elegir.
  const redirect = searchParams.get('redirect') || '/marketplace';

  const { profiles, setActiveProfile, reloadProfiles } = useMarketplaceAuth();

  // Estado del modal "Añadir perfil".
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', dateOfBirth: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Elegir un perfil: lo marcamos como activo y volvemos al marketplace.
  function choose(p: MarketplaceProfile) {
    setActiveProfile(p);
    router.replace(redirect);
  }

  // Crear un perfil hijo/familiar.
  async function submitCreate() {
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('El nombre y el apellido son obligatorios');
      return;
    }
    setCreating(true);
    try {
      await marketplaceApi.post('/profiles', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        relationship: 'CHILD',
        dateOfBirth: form.dateOfBirth || undefined,
      });
      await reloadProfiles();
      setShowCreate(false);
      setForm({ firstName: '', lastName: '', dateOfBirth: '' });
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear el perfil');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        {/* Mensaje explicativo claro sobre el uso de los perfiles */}
        <h1 className="text-2xl font-bold text-gray-900 mb-1">¿Quién va a la cita?</h1>
        <p className="text-sm text-gray-500 mb-8">
          Elige un perfil. Crea perfiles para gestionar las citas de tus hijos o
          familiares a tu cargo: cada perfil tiene sus propias citas, puntos e
          historial.
        </p>

        {/* Grilla de perfiles + tarjeta "Añadir" */}
        <div className="grid grid-cols-3 gap-4">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => choose(p)}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden text-xl font-bold text-white group-hover:ring-2 group-hover:ring-[#008080] transition-all"
                  style={{ backgroundColor: TEAL }}
                >
                  {p.avatarUrl ? (
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${p.avatarUrl}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initials(p)
                  )}
                </div>
                {/* Etiqueta para perfiles de menores */}
                {p.isMinor && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#008080] text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                    Menor
                  </span>
                )}
              </div>
              <span className="text-xs font-medium text-gray-700 truncate max-w-[5rem]">
                {p.relationship === 'SELF' ? 'Yo' : p.firstName}
              </span>
            </button>
          ))}

          {/* Añadir perfil */}
          <button
            onClick={() => { setError(null); setShowCreate(true); }}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 group-hover:border-[#008080] group-hover:text-[#008080] transition-colors">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">Añadir</span>
          </button>
        </div>
      </div>

      {/* Modal: crear perfil hijo/familiar */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nuevo perfil</h2>
            {error && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Apellido *</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Fecha de nacimiento</label>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={submitCreate}
                disabled={creating}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
              >
                {creating ? 'Creando...' : 'Crear perfil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
