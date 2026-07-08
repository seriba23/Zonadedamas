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

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMarketplaceAuth, MarketplaceProfile } from '@/lib/hooks/use-marketplace-auth';
import { marketplaceApi } from '@/lib/marketplace-api';
import { signOutAll } from '@/lib/sign-out-all';
import { resolveImageUrl } from '@/lib/utils';
import { OnboardingCarousel, type OnboardingSlide } from '@/components/ui/onboarding-carousel';

const TEAL = '#008080';

// Marca (por dispositivo) de que el usuario ya vio el onboarding de perfiles.
// Se muestra la primera vez que llega al selector (2º login) y se puede volver a
// abrir con el icono ⓘ.
const PROFILES_ONBOARDING_KEY = 'mp_profiles_onboarding_seen';

// Los 3 slides que explican los perfiles familiares (blanco + acentos teal).
const PROFILE_SLIDES: OnboardingSlide[] = [
  {
    icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
    title: 'Perfiles para tu familia',
    text: 'Crea un perfil para cada persona a tu cargo —hijos o familiares—. Reservas y gestionas sus citas desde tu misma cuenta.',
  },
  {
    icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
    title: 'Cada quien, lo suyo',
    text: 'Cada perfil guarda por separado sus citas, puntos, cupones e historial. Nada se mezcla entre familiares.',
  },
  {
    icon: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
    title: 'Cambia cuando quieras',
    text: 'Elige con qué perfil entras al abrir la app. Aquí puedes crear, editar o quitar perfiles con "Gestionar perfiles".',
  },
];

// Iniciales para el avatar cuando no hay foto (primera letra de nombre+apellido).
function initials(p: { firstName: string; lastName: string }) {
  return `${p.firstName?.[0] || ''}${p.lastName?.[0] || ''}`.toUpperCase();
}

// ¿La fecha de nacimiento (texto "AAAA-MM-DD") corresponde a un menor de edad (<18)?
function isMinorFromDob(dob?: string | null): boolean {
  if (!dob) return false;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age < 18;
}

// Estado vacío del formulario de perfil.
// Paleta de colores para los perfiles (misma que la de empleados).
const PROFILE_COLORS = [
  '#008080', '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16', '#06b6d4',
];

const emptyForm = { firstName: '', lastName: '', dateOfBirth: '', gender: '', allergies: '', color: '' };

export default function ProfilesSelectorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Si vinimos de un enlace protegido, ?redirect= trae a dónde volver tras elegir.
  const redirect = searchParams.get('redirect') || '/marketplace';

  const { profiles, setActiveProfile, reloadProfiles } = useMarketplaceAuth();

  // Recargamos la lista de perfiles al entrar al selector, por si el contexto
  // quedó vacío o desactualizado (p.ej. al llegar directo tras el login).
  useEffect(() => {
    reloadProfiles();
  }, [reloadProfiles]);

  // manage: modo gestión (muestra editar/eliminar en vez de seleccionar).
  const [manage, setManage] = useState(false);
  // modalFor: null = cerrado; 'new' = crear; un perfil = editar ese perfil.
  const [modalFor, setModalFor] = useState<'new' | MarketplaceProfile | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Aceptación del aviso/términos para perfiles de menores.
  const [termsAccepted, setTermsAccepted] = useState(false);
  // entering: true mientras navegamos al marketplace tras elegir perfil. Sirve
  // para cubrir la pantalla con un loader y NO mostrar el marketplace de fondo
  // por un instante (se veía raro).
  const [entering, setEntering] = useState(false);

  // Onboarding de perfiles: se muestra la PRIMERA vez que el usuario llega al
  // selector (2º login) y luego se puede reabrir con el icono ⓘ.
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(PROFILES_ONBOARDING_KEY)) {
      setShowOnboarding(true);
    }
  }, []);
  // Cierra el onboarding y recuerda que ya se vio (no reaparece solo).
  function closeOnboarding() {
    if (typeof window !== 'undefined') localStorage.setItem(PROFILES_ONBOARDING_KEY, '1');
    setShowOnboarding(false);
  }

  // Elegir un perfil: lo marcamos como activo y volvemos al marketplace.
  function choose(p: MarketplaceProfile) {
    setEntering(true);
    setActiveProfile(p);
    router.replace(redirect);
  }

  // Abre el modal para crear un perfil nuevo.
  function openCreate() {
    setError(null);
    // Color por defecto: el siguiente de la paleta según cuántos perfiles hay.
    setForm({ ...emptyForm, color: PROFILE_COLORS[profiles.length % PROFILE_COLORS.length] });
    setTermsAccepted(false);
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
      color: p.color || '',
    });
    // Si ya había aceptado el aviso de menor, no se lo volvemos a exigir.
    setTermsAccepted(!!p.guardianTermsAcceptedAt);
    setModalFor(p);
  }

  // Guarda: crea (POST) o edita (PUT) según modalFor.
  async function save() {
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('El nombre y el apellido son obligatorios');
      return;
    }
    // Si el perfil es de un menor y aún no se había aceptado el aviso, exigirlo.
    const alreadyAccepted = modalFor !== 'new' && !!modalFor?.guardianTermsAcceptedAt;
    if (isMinorFromDob(form.dateOfBirth) && !alreadyAccepted && !termsAccepted) {
      setError('Debes aceptar el aviso para perfiles de menores');
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
        color: form.color || undefined,
        guardianTermsAccepted: termsAccepted,
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

  // Mientras navegamos al marketplace tras elegir perfil, cubrimos todo con un
  // loader para no mostrar el marketplace de fondo por un instante.
  if (entering) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-[#008080] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        {/* Título + icono ⓘ para reabrir el onboarding de perfiles. */}
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Elige un perfil</h1>
          <button
            onClick={() => setShowOnboarding(true)}
            aria-label="¿Cómo funcionan los perfiles?"
            title="¿Cómo funcionan los perfiles?"
            className="text-gray-400 hover:text-[#008080] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Puedes crear perfiles para gestionar las citas de tus hijos o
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
                  className="relative w-20 h-20 rounded-full flex items-center justify-center overflow-hidden text-xl font-bold text-white group-hover:ring-2 group-hover:ring-[#008080] transition-all"
                  style={{ backgroundColor: p.color || TEAL }}
                >
                  {/* Iniciales de fondo: si la imagen falla (URL rota o de Google
                      que expira), quedan visibles como respaldo. */}
                  <span className="absolute inset-0 flex items-center justify-center">{initials(p)}</span>
                  {p.avatarUrl && (
                    <img
                      // resolveImageUrl respeta las URLs http(s) (Google) y solo
                      // antepone la API a las rutas locales — sin él se armaba
                      // "http://localhost:3001https://lh3..." (rota).
                      src={resolveImageUrl(p.avatarUrl) || ''}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      className="relative w-full h-full object-cover"
                    />
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

        {/* Acciones de cuenta, hasta abajo: cambiar de tipo de cuenta
            (cliente/empleado/administrador) y cerrar sesión. */}
        <div className="mt-10 pt-6 border-t border-gray-200 space-y-2">
          <button
            onClick={() => router.push('/login')}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Elige el tipo de acceso
          </button>
          <button
            onClick={async () => { await signOutAll(); router.push('/login'); }}
            className="w-full py-2.5 rounded-xl border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
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

              {/* Selector de color del perfil */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Color del perfil</label>
                <div className="flex flex-wrap gap-2">
                  {PROFILE_COLORS.map((c) => {
                    const active = (form.color || PROFILE_COLORS[0]) === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, color: c }))}
                        className={`w-7 h-7 rounded-full transition-transform ${active ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                        style={{ backgroundColor: c }}
                        aria-label={`Color ${c}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Aviso y términos para perfiles de menores: solo si la fecha de
                nacimiento lo hace menor y aún no se había aceptado. */}
            {isMinorFromDob(form.dateOfBirth) &&
              !(modalFor !== 'new' && modalFor?.guardianTermsAcceptedAt) && (
                <div className="mt-4 rounded-xl border border-[#008080] bg-[#e0f2f1]/40 p-3">
                  <p className="text-xs font-semibold text-[#006666] mb-1">
                    Aviso para perfiles de menores de edad
                  </p>
                  <div className="max-h-32 overflow-y-auto text-[11px] text-gray-600 leading-snug space-y-1 pr-1">
                    <p>Al crear y usar un perfil de un menor de edad, declaras y aceptas que:</p>
                    <p>1. Eres el <span className="font-semibold">padre, madre o tutor legal</span> del menor y cuentas con la patria potestad o representación legal para gestionar sus citas y autorizar en su nombre.</p>
                    <p>2. <span className="font-semibold">Siliba es únicamente una plataforma tecnológica</span> que conecta clientes con negocios. Siliba no presta los servicios, no toma las fotografías ni decide su uso, y <span className="font-semibold">no es responsable</span> de los actos, omisiones, contenidos ni del tratamiento de datos o imágenes que realicen los negocios.</p>
                    <p>3. Cualquier consentimiento, autorización o acuerdo sobre tomar, usar o publicar fotografías del menor (por ejemplo, en el portafolio del negocio) se celebra <span className="font-semibold">directa y exclusivamente entre tú (el tutor) y el negocio</span>. Siliba no es parte de ese acuerdo.</p>
                    <p>4. Eres responsable de otorgar o negar ese consentimiento al negocio y, en su caso, de solicitar que se <span className="font-semibold">oculte el rostro del menor</span>.</p>
                    <p>5. Los datos que proporcionas son veraces y usarás la plataforma conforme a la ley.</p>
                  </div>
                  <label className="flex items-start gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5"
                      style={{ accentColor: TEAL }}
                    />
                    <span className="text-[11px] font-medium text-gray-700">
                      He leído y acepto el aviso para perfiles de menores, y confirmo que actúo como su tutor.
                    </span>
                  </label>
                </div>
              )}

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

      {/* Onboarding de perfiles (blanco + acentos teal). Se muestra la primera
          vez que se llega al selector y se reabre con el icono ⓘ del título. */}
      {showOnboarding && (
        <OnboardingCarousel
          slides={PROFILE_SLIDES}
          theme="light"
          accent={TEAL}
          doneLabel="Entendido"
          onDone={closeOnboarding}
          onSkip={closeOnboarding}
        />
      )}
    </div>
  );
}
