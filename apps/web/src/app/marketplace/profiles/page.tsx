// ============================================================
// PÁGINA: Selector y gestión de perfiles (estilo Netflix)
// RUTA:   /marketplace/profiles
//
// Se muestra tras iniciar sesión. El usuario (tutor) elige bajo qué perfil
// operar: el suyo o el de un hijo/familiar a su cargo. Cada perfil tiene sus
// propias citas, puntos e historial. Desde el modo "Gestionar" puede crear,
// editar o eliminar perfiles (no el suyo propio).
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

// Estado vacío del formulario de perfil.
const emptyForm = { firstName: '', lastName: '', dateOfBirth: '', gender: '', allergies: '' };

export default function ProfilesSelectorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Si vinimos de un enlace protegido, ?redirect= trae a dónde volver tras elegir.
  const redirect = searchParams.get('redirect') || '/marketplace';

  const { profiles, setActiveProfile, reloadProfiles } = useMarketplaceAuth();

  // manage: modo gestión (muestra editar/eliminar en vez de seleccionar).
  const [manage, setManage] = useState(false);
  // modalFor: null = cerrado; 'new' = crear; un perfil = editar ese perfil.
  const [modalFor, setModalFor] = useState<'new' | MarketplaceProfile | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Elegir un perfil: lo marcamos como activo y volvemos al marketplace.
  function choose(p: MarketplaceProfile) {
    setActiveProfile(p);
    router.replace(redirect);
  }

  // Abre el modal para crear un perfil nuevo.
  function openCreate() {
    setError(null);
    setForm(emptyForm);
    setModalFor('new');
  }

  // Abre el modal para editar un perfil existente (precarga sus datos).
  function openEdit(p: MarketplaceProfile) {
    setError(null);
    setForm({
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      // La fecha viene como ISO; nos quedamos con la parte "AAAA-MM-DD".
      dateOfBirth: p.dateOfBirth ? String(p.dateOfBirth).substring(0, 10) : '',
      gender: p.gender || '',
      allergies: p.allergies || '',
    });
    setModalFor(p);
  }

  // Guarda: crea (POST) o edita (PUT) según modalFor.
  async function save() {
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('El nombre y el apellido son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        allergies: form.allergies || undefined,
      };
      if (modalFor === 'new') {
        await marketplaceApi.post('/profiles', { ...payload, relationship: 'CHILD' });
      } else if (modalFor) {
        await marketplaceApi.put(`/profiles/${modalFor.id}`, payload);
      }
      await reloadProfiles();
      setModalFor(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar el perfil');
    } finally {
      setSaving(false);
    }
  }

  // Elimina (archiva) un perfil. Solo perfiles que no sean el propio (SELF).
  async function remove(p: MarketplaceProfile) {
    setError(null);
    setSaving(true);
    try {
      await marketplaceApi.del(`/profiles/${p.id}`);
      await reloadProfiles();
      setModalFor(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudo eliminar el perfil');
    } finally {
      setSaving(false);
    }
  }

  // ¿El perfil que se está editando es el propio (SELF)? No se puede eliminar.
  const editingSelf = modalFor && modalFor !== 'new' && modalFor.relationship === 'SELF';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        {/* Mensaje explicativo claro sobre el uso de los perfiles */}
        <h1 className="text-2xl font-bold text-gray-900 mb-1">¿Quién va a la cita?</h1>
        <p className="text-sm text-gray-500 mb-6">
          Elige un perfil. Crea perfiles para gestionar las citas de tus hijos o
          familiares a tu cargo: cada perfil tiene sus propias citas, puntos e
          historial.
        </p>

        {/* Grilla de perfiles + tarjeta "Añadir" */}
        <div className="grid grid-cols-3 gap-4">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => (manage ? openEdit(p) : choose(p))}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden text-xl font-bold text-white group-hover:ring-2 group-hover:ring-[#008080] transition-all"
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
                {/* En modo gestión, ícono de lápiz; etiqueta "Menor" si aplica */}
                {manage && (
                  <span className="absolute -top-1 -right-1 bg-white border border-gray-200 rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
                    <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </span>
                )}
                {p.isMinor && !manage && (
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
          <button onClick={openCreate} className="flex flex-col items-center gap-2 group">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 group-hover:border-[#008080] group-hover:text-[#008080] transition-colors">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="text-xs font-medium text-gray-500">Añadir</span>
          </button>
        </div>

        {/* Botón para alternar modo gestión */}
        <button
          onClick={() => setManage((m) => !m)}
          className="mt-8 text-sm font-medium text-gray-500 hover:text-[#008080] transition-colors"
        >
          {manage ? 'Listo' : 'Gestionar perfiles'}
        </button>
      </div>

      {/* Modal: crear/editar perfil */}
      {modalFor && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6"
          onClick={() => setModalFor(null)}
        >
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {modalFor === 'new' ? 'Nuevo perfil' : 'Editar perfil'}
            </h2>
            {error && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Alergias / notas médicas</label>
                <textarea
                  value={form.allergies}
                  onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setModalFor(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: TEAL }}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>

            {/* Eliminar: solo al editar un perfil que NO sea el propio */}
            {modalFor !== 'new' && !editingSelf && (
              <button
                onClick={() => remove(modalFor)}
                disabled={saving}
                className="w-full mt-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                Eliminar perfil
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
