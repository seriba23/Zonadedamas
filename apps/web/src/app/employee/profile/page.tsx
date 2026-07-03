// ─── profile/page.tsx — Perfil del Empleado ──────────────────────────────
//
// Esta página está en /employee/profile y muestra 4 pestañas:
//
//   1. "Info Personal" → editar datos básicos (nombre, email, teléfono, bio,
//      foto de perfil, foto de portada, color de banner, info médica, contacto
//      de emergencia). Todo en modo vista/edición inline.
//
//   2. "Perfil Público" → vista previa de cómo ve el cliente el perfil del
//      empleado en el marketplace (consume el endpoint público del marketplace).
//
//   3. "Portafolio" → galería de fotos de trabajos del empleado (componente
//      PortfolioGallery compartido con el panel de administración).
//
//   4. "Estadísticas" → tarjetas con métricas (citas completadas, ingresos,
//      valoración, tasa de cancelación) y tabla de servicios más realizados.
//
// CARACTERÍSTICAS ESPECIALES:
// - La foto de avatar y la portada tienen un modal de recorte (crop) antes
//   de subir, para que el empleado ajuste el encuadre.
// - El URL puede incluir ?tab=info|public|portfolio|stats para abrir una
//   pestaña específica directamente (deep-link desde notificaciones).

'use client';

import { useState, useRef, useEffect } from 'react';
// useState → pestaña activa, modo edición, mensajes de éxito, etc.
// useRef   → referencias a los <input type="file"> ocultos (para avatar y portada).
// useEffect → aunque se importa no se usa directamente en este componente raíz
//             (puede usarse en los sub-componentes).

import { useSearchParams } from 'next/navigation';
// useSearchParams → leer parámetros de la URL.
// Ejemplo: /employee/profile?tab=portfolio → abre la pestaña de portafolio.

import { useAuth } from '@/lib/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { showSaveSuccess } from '@/lib/save-toast';
import { formatCurrency as rawFormatCurrency } from '@/lib/utils';
import { useCurrency } from '@/lib/hooks/use-currency';

import { PortfolioGallery } from '@/components/staff/portfolio-gallery';
// PortfolioGallery → galería editable de fotos de trabajos del empleado.
// La misma que usa el admin al ver el detalle de un empleado.

import { EmployeeSettingsContent } from '../settings/settings-content';
// EmployeeSettingsContent → importado pero usado en otra sección (ajustes).

import { AvatarCropModal } from '@/components/ui/avatar-crop-modal';
// AvatarCropModal → modal que permite recortar la foto de perfil en formato
// circular antes de subirla al servidor.

import { CoverCropModal } from '@/components/ui/cover-crop-modal';
// CoverCropModal → similar a AvatarCropModal pero para la imagen de portada
// (proporción 9:16 vertical, como las fotos de Instagram Stories).

import { AllergiesSelector } from '@/components/ui/allergies-selector';
// AllergiesSelector → selector múltiple de alergias comunes con chips.

import Link from 'next/link';

// API_URL → base del servidor backend. Se lee de una variable de entorno
// definida en .env.local. Si no existe, usa localhost:3001 por defecto.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── Interfaz Employee ────────────────────────────────────────────────────
// Define la forma del objeto empleado que devuelve el backend.
// El símbolo ? al final del nombre indica que el campo es OPCIONAL (puede
// no venir en la respuesta). El tipo | null indica que puede ser nulo.
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  color: string;           // color teal del banner/avatar (#008080 u otro)
  bio: string;             // presentación / texto de descripción pública
  avatarUrl: string | null;       // URL relativa de la foto de perfil (null si no tiene)
  coverImageUrl: string | null;   // URL relativa de la foto de portada (null si no tiene)
  jobTitle: string | null;        // cargo/título profesional ("Estilista", "Barber", etc.)
  bloodType: string | null;       // tipo de sangre para emergencias
  emergencyContactName: string | null;
  emergencyContactLastName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  allergies: string | null;       // alergias separadas por coma
  // employeeServices? → lista de servicios que ofrece este empleado.
  // El ? hace el campo opcional: si el endpoint no lo incluye, no falla.
  employeeServices?: { service: { id: string; name: string } }[];
}

// ─── Interfaz Stats ───────────────────────────────────────────────────────
// Datos de rendimiento del empleado para la pestaña "Estadísticas".
interface Stats {
  completedAllTime: number;    // total de citas completadas (histórico)
  completedThisMonth: number;  // citas completadas en el mes actual
  cancellationRate: number;    // % de cancelaciones sobre el total
  totalRevenue: number;        // ingresos generados (suma de citas completadas)
  averageRating: number | null; // valoración media; null si no tiene reseñas
  totalReviews: number;        // número total de reseñas recibidas
  // topServices → servicios más realizados, ordenados por conteo (mayor primero)
  topServices: { serviceName: string; count: number }[];
}

// Tab: tipo unión de las 4 pestañas posibles.
// Solo puede ser uno de estos 4 valores (TypeScript lo garantiza en tiempo de compilación).
type Tab = 'info' | 'public' | 'portfolio' | 'stats';

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────
// EmployeeProfilePage → página raíz en /employee/profile.
// Orquesta las 4 pestañas y comparte datos comunes (employee, stats, tenantSlug)
// con los sub-componentes a través de props.
export default function EmployeeProfilePage() {
  // user → usuario autenticado del contexto de auth.
  // Contiene: id, name, email, employeeId, tenantId, avatarUrl, etc.
  const { user } = useAuth();

  // useCurrency → hook personalizado que devuelve la función format()
  // configurada con la moneda del negocio (MXN, USD, etc.).
  // Si el hook no está disponible (null), usa rawFormatCurrency como respaldo.
  const currencyHook = useCurrency();
  const formatCurrency = currencyHook?.format ?? rawFormatCurrency;

  // queryClient → cliente de React Query para invalidar caché manualmente.
  // Se usa en onSave para refrescar los datos del empleado tras guardar.
  const queryClient = useQueryClient();

  // searchParams → objeto de solo lectura con los ?parámetros de la URL.
  // Ejemplo: /employee/profile?tab=portfolio → searchParams.get('tab') = 'portfolio'
  const searchParams = useSearchParams();

  // activeTab → pestaña visible actualmente.
  // Se inicializa desde el parámetro ?tab de la URL, o 'info' por defecto.
  // La sintaxis (searchParams.get('tab') as Tab) convierte el string a tipo Tab.
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'info');

  // cropFile → archivo de imagen seleccionado para recortar (modal crop del avatar).
  // null = el modal de crop NO está visible.
  const [cropFile, setCropFile] = useState<File | null>(null);

  // fileInputRef → referencia al <input type="file"> oculto en el JSX.
  // Permite activarlo con código: fileInputRef.current?.click()
  // (sin mostrar ningún botón nativo del navegador).
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Petición 1: datos del empleado ─────────────────────────────────────
  // useQuery lanza automáticamente GET /api/employees/{id} cuando el componente
  // se monta (o cuando cambia employeeId).
  // queryKey: ['employee-profile', user?.employeeId] → identifica esta caché.
  //   Si el mismo componente se monta de nuevo con el mismo id, no hace
  //   petición HTTP: devuelve los datos del caché.
  // enabled: !!user?.employeeId → la doble negación (!!) convierte cualquier
  //   valor truthy a true. Solo ejecuta si hay un employeeId válido.
  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee-profile', user?.employeeId],
    queryFn: async () => {
      const res = await api.get<{ data: Employee }>(
        `/api/employees/me`,
        // user! → aserción de no-nulo: "confío en que user existe aquí"
        // porque enabled garantiza que esta función solo corre con user válido.
      );
      return res.data; // extrae la propiedad .data del objeto { data: Employee }
    },
    enabled: !!user?.employeeId,
  });

  // ─── Petición 2: estadísticas del empleado ───────────────────────────────
  // No tiene isLoading propio (se maneja con isLoading del employee arriba).
  // stats puede ser undefined mientras carga (se maneja con un spinner en JSX).
  const { data: stats } = useQuery({
    queryKey: ['employee-profile-stats', user?.employeeId],
    queryFn: async () => {
      const res = await api.get<{ data: Stats }>(
        `/api/employees/me/stats`,
      );
      return res.data;
    },
    enabled: !!user?.employeeId,
  });

  // ─── Petición 3: slug del negocio ────────────────────────────────────────
  // El slug es el identificador URL-friendly del negocio (ej: "beauty-studio").
  // Se necesita para construir la URL del perfil público en el marketplace.
  const { data: tenantData } = useQuery({
    queryKey: ['tenant-slug'],
    queryFn: async () => {
      const res = await api.get<{ data: { slug: string } }>('/api/tenants/current');
      return res.data;
    },
  });

  // ─── Mutación: subir avatar ───────────────────────────────────────────────
  // useMutation para operaciones de escritura (POST, PUT, DELETE, upload).
  // mutationFn → función que se ejecuta al llamar avatarMutation.mutate(file).
  // api.upload → envía el archivo como multipart/form-data.
  // onSuccess → cuando el servidor responde OK:
  //   1. Invalida el caché de 'employee-profile' → fuerza re-fetch.
  //   2. Muestra mensaje de éxito por 3 segundos.
  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      return api.upload<{ data: { avatarUrl: string } }>(
        `/api/employees/me/avatar`,
        file,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-profile'] });
      showSaveSuccess({ title: 'Foto actualizada' });
    },
  });

  // ─── Guard: sin employeeId ────────────────────────────────────────────────
  // Si el usuario autenticado no tiene employeeId (ej: un administrador puro
  // que entró a esta ruta), mostramos un mensaje de error y cortamos el render.
  // El return temprano evita que el resto del código ejecute con datos inválidos.
  if (!user?.employeeId) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
          Tu cuenta no está vinculada a un perfil de empleado.
        </div>
      </div>
    );
  }

  // ─── Estado de carga ──────────────────────────────────────────────────────
  // isLoading es true mientras la primera petición (employee) no ha respondido.
  // Mostramos un spinner circular animado (animate-spin) hasta que tengamos datos.
  if (isLoading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
      </div>
    );
  }

  // avatarBg → objeto de estilos en línea para el círculo del avatar.
  // Usa el color del empleado con transparencia del 13% (sufijo '22' en hex).
  // employee?.color → encadenamiento opcional: si employee es null/undefined no falla.
  // Ejemplo: '#00808022' → teal con 13% opacidad de fondo.
  const avatarBg = employee?.color
    ? { backgroundColor: employee.color + '22', color: employee.color }
    : { backgroundColor: '#00808022', color: '#008080' };

  // tenantSlug → identificador URL del negocio (puede ser undefined si aún carga).
  const tenantSlug = tenantData?.slug;

  // profileUrl → URL completa del perfil público de este empleado en el marketplace.
  // Solo se construye si tenemos tanto el slug como los datos del empleado.
  // Ejemplo: '/marketplace/beauty-studio/professional/cldkjh123'
  const profileUrl = tenantSlug && employee ? `/marketplace/${tenantSlug}/professional/${employee.id}` : null;

  // specialty → nombre del primer servicio que ofrece el empleado.
  // Se usa como "especialidad" en algunas vistas.
  // ?. → encadenamiento opcional: si employeeServices es undefined/null, devuelve undefined.
  // [0] → primer elemento del arreglo (el más relevante o el primero configurado).
  const specialty = employee?.employeeServices?.[0]?.service?.name || null;

  return (
    <div className="max-w-4xl mx-auto pb-24 lg:pb-6">
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) setCropFile(file); e.target.value = ''; }} />

      {/* Tabs */}
      <div className="border-b border-gray-200 px-6 mb-6">
        <nav className="flex gap-6">
          {([
            { key: 'info' as Tab, label: 'Info Personal' },
            { key: 'public' as Tab, label: 'Perfil Público' },
            { key: 'portfolio' as Tab, label: 'Portafolio' },
            { key: 'stats' as Tab, label: 'Estadísticas' },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-[#008080] text-[#008080]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'info' && employee && (
        <InfoPersonalTab employee={employee} onSave={() => {
          queryClient.invalidateQueries({ queryKey: ['employee-profile'] });
          queryClient.invalidateQueries({ queryKey: ['public-profile-preview'] });
        }} />
      )}

      {activeTab === 'public' && employee && tenantData?.slug && (
        <PublicProfilePreview tenantSlug={tenantData.slug} employeeId={employee.id} />
      )}

      {activeTab === 'portfolio' && (
        <PortfolioGallery
          employeeId={user.employeeId}
          canEdit={true}
          self={true}
        />
      )}

      {activeTab === 'stats' && employee && (
        <div className="space-y-6">
          {!stats ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
            </div>
          ) : (
            <>
              {/* Stats cards */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-medium text-gray-500 mb-1">Total completadas</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.completedAllTime}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-medium text-gray-500 mb-1">Este mes</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.completedThisMonth}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-medium text-gray-500 mb-1">Valoración</p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-bold text-amber-500">
                      {stats.averageRating ?? '-'}
                    </p>
                    {stats.averageRating && (
                      <svg className="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{stats.totalReviews} reseñas</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-medium text-gray-500 mb-1">Tasa de cancelación</p>
                  <p className={`text-3xl font-bold ${stats.cancellationRate > 20 ? 'text-red-500' : stats.cancellationRate > 10 ? 'text-amber-500' : 'text-green-600'}`}>
                    {stats.cancellationRate}%
                  </p>
                </div>
              </div>

              {/* Top services */}
              {stats.topServices.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Servicios más realizados</h3>
                  <div className="space-y-3">
                    {stats.topServices.map((s, i) => {
                      const maxCount = stats.topServices[0].count;
                      const pct = Math.round((s.count / maxCount) * 100);
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-700">{s.serviceName}</span>
                            <span className="font-medium text-gray-900">{s.count}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-primary-500 h-2 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Crop Modal */}
      {cropFile && (
        <AvatarCropModal
          imageFile={cropFile}
          onCancel={() => setCropFile(null)}
          onChooseAnother={() => {
            setCropFile(null);
            fileInputRef.current?.click();
          }}
          onAccept={(croppedFile) => {
            avatarMutation.mutate(croppedFile);
            setCropFile(null);
          }}
        />
      )}

    </div>
  );
}

function InfoField({ label, value, placeholder = '—' }: { label: string; value?: string | null; placeholder?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-sm text-gray-700">{value || placeholder}</p>
    </div>
  );
}

function PersonalInfoEditor({ employee, onSave }: { employee: Employee; onSave: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    bloodType: employee.bloodType || '',
    allergies: employee.allergies || '',
    emergencyContactName: employee.emergencyContactName || '',
    emergencyContactLastName: employee.emergencyContactLastName || '',
    emergencyContactPhone: employee.emergencyContactPhone || '',
    emergencyContactRelation: employee.emergencyContactRelation || '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/api/employees/me/personal-info', form);
      onSave();
      setEditing(false);
    } catch {}
    setSaving(false);
  }

  if (!editing) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Información Personal</h3>
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm text-[#008080] hover:text-[#006666] font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            Editar
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <InfoField label="Alergias" value={employee.allergies} placeholder="Ninguna conocida" />
        </div>
        <div className="pt-4 mt-4 border-t border-gray-100">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">Contacto de emergencia</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoField label="Nombre" value={employee.emergencyContactName} />
            <InfoField label="Apellido" value={employee.emergencyContactLastName} />
            <InfoField label="Teléfono" value={employee.emergencyContactPhone} />
            <InfoField label="Relación" value={employee.emergencyContactRelation} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#008080] p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Información Personal</h3>
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Alergias <span className="text-[10px] text-gray-400 font-normal">(opcional)</span>
        </label>
        <AllergiesSelector value={form.allergies} onChange={(v) => setForm((f) => ({ ...f, allergies: v }))} />
      </div>

      <h4 className="text-sm font-semibold text-gray-800 mb-3 pt-3 border-t border-gray-100">Contacto de emergencia</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
          <input type="text" autoComplete="off" name="emergencyName" value={form.emergencyContactName} onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))} className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label>
          <input type="text" autoComplete="off" name="emergencyLastName" value={form.emergencyContactLastName} onChange={(e) => setForm((f) => ({ ...f, emergencyContactLastName: e.target.value }))} className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            name="emergencyPhone"
            value={form.emergencyContactPhone}
            onChange={(e) => setForm((f) => ({ ...f, emergencyContactPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
            placeholder="10 dígitos"
            maxLength={10}
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Relación</label>
          <input type="text" autoComplete="off" value={form.emergencyContactRelation} onChange={(e) => setForm((f) => ({ ...f, emergencyContactRelation: e.target.value }))} className="input-field" placeholder="Ej: Esposo/a, Padre, Madre" />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#008080' }}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function PublicProfilePreview({ tenantSlug, employeeId }: { tenantSlug: string; employeeId: string }) {
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  // IDs de fotos cuyo archivo ya no existe (404): las ocultamos para no mostrar
  // recuadros de imagen rota en el portafolio.
  const [failedImgIds, setFailedImgIds] = useState<Set<string>>(new Set());

  const { data: pro, isLoading } = useQuery({
    queryKey: ['public-profile-preview', tenantSlug, employeeId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/marketplace/professional/${tenantSlug}/${employeeId}`);
      if (!res.ok) throw new Error('Not found');
      const json = await res.json();
      return json.data;
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-[#008080] rounded-full" /></div>;
  if (!pro) return <div className="text-center py-12 text-gray-400 text-sm">No se pudo cargar la vista pública</div>;

  const fullName = `${pro.firstName} ${pro.lastName}`;
  const specialty = pro.topServices?.length > 0 ? pro.topServices[0].serviceName : null;
  // Portafolio sin las fotos cuyo archivo falló (rotas): solo imágenes existentes.
  const visiblePortfolio: any[] = (pro.portfolio || []).filter((img: any) => !failedImgIds.has(img.id));

  return (
    <div className="px-0 lg:px-6">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden mb-6" style={{ minHeight: 260 }}>
        {pro.coverImageUrl || pro.avatarUrl ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${API_URL}${pro.coverImageUrl || pro.avatarUrl})` }}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
          </div>
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${pro.color || '#008080'}dd 0%, ${pro.color || '#008080'}44 50%, #1a1a2e 100%)` }} />
        )}

        {pro.averageRating && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md">
            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-sm font-bold text-white">{pro.averageRating}</span>
            <span className="text-[10px] text-white/60">({pro.totalReviews})</span>
          </div>
        )}

        <div className="relative z-10 flex flex-col justify-end min-h-[260px] px-6 pb-6">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-white/90 text-xs font-medium mb-2 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#008080]" />
            {pro.businessName}
          </span>
          <h2 className="text-2xl font-bold text-white mb-0.5">{fullName}</h2>
          {pro.bio && (
            <p
              className="text-xs text-white/70 max-w-lg max-h-28 overflow-y-auto pr-1 whitespace-pre-line"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) transparent' }}
            >
              {pro.bio}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md">
              <svg className="w-4 h-4 text-[#008080]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-bold text-white leading-none">{pro.completedAppointments}</p>
                <p className="text-[9px] text-white/60 uppercase">Trabajos</p>
              </div>
            </div>
            {specialty && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md">
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-white leading-none">{specialty}</p>
                  <p className="text-[9px] text-white/60 uppercase">Especialidad</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Portfolio */}
      {visiblePortfolio.length > 0 && (
        <div className="mb-6 px-6 lg:px-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#008080]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
            Portafolio
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {visiblePortfolio.map((img: any) => (
              <button key={img.id} onClick={() => setLightboxImg(`${API_URL}${img.imageUrl}`)} className="relative aspect-square rounded-xl overflow-hidden group">
                <img src={`${API_URL}${img.imageUrl}`} alt={img.caption || ''} onError={() => setFailedImgIds((prev) => new Set(prev).add(img.id))} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                {img.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs text-white truncate">{img.caption}</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {pro.reviews?.length > 0 && (
        <div className="px-6 lg:px-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Comentarios de clientes
            </h3>
            <span className="text-xs text-gray-400">{pro.reviews.length}</span>
          </div>
          <div className="space-y-3">
            {pro.reviews.map((review: any) => (
              <div key={review.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-500 flex-shrink-0 overflow-hidden">
                    {review.clientAvatarUrl ? (
                      <img src={`${API_URL}${review.clientAvatarUrl}`} alt="" className="w-full h-full object-cover" />
                    ) : review.clientName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900">{review.clientName}</p>
                      <p className="text-[10px] text-gray-400">{new Date(review.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div className="flex gap-0.5 mb-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    {review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {visiblePortfolio.length === 0 && (!pro.reviews || pro.reviews.length === 0) && (
        <div className="text-center py-12 text-gray-400 text-sm px-6">
          <p>Tu perfil público aún no tiene portafolio ni reseñas.</p>
          <p className="text-xs mt-1">Sube fotos a tu galería y completa servicios para que los clientes te califiquen.</p>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
          <button onClick={() => setLightboxImg(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const RELATIONS = ['Padre/Madre', 'Hermano/a', 'Esposo/a', 'Pareja', 'Hijo/a', 'Tío/a', 'Amigo/a', 'Otro'];

function InfoPersonalTab({ employee, onSave }: { employee: Employee; onSave: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: employee.firstName, lastName: employee.lastName,
    email: employee.email || '', phone: employee.phone || '', bio: employee.bio || '',
    color: employee.color || '#008080',
    bloodType: employee.bloodType || '', allergies: employee.allergies || '',
    emergencyContactName: employee.emergencyContactName || '',
    emergencyContactLastName: employee.emergencyContactLastName || '',
    emergencyContactPhone: employee.emergencyContactPhone || '',
    emergencyContactRelation: employee.emergencyContactRelation || '',
  });
  const [saving, setSaving] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  // Override local: la URL nueva que devuelve el servidor tras subir, para
  // mostrar la imagen AL INSTANTE sin recargar la página (igual que el avatar).
  const [coverOverride, setCoverOverride] = useState<string | null>(null);
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  // Cuando el usuario selecciona archivo, lo guardamos aqui para
  // mostrarlo en el crop modal correspondiente antes de subir.
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);

  // Paleta para el color del banner cuando no hay foto de portada. Mismo
  // patron que usa /staff al crear empleado.
  const COLOR_PALETTE = [
    '#008080', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444',
    '#A855F7', '#EC4899', '#F97316', '#6366F1', '#14B8A6',
    '#84CC16', '#64748B',
  ];

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/api/employees/me', { firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone, bio: form.bio, color: form.color });
      await api.put('/api/employees/me/personal-info', { bloodType: form.bloodType, allergies: form.allergies, emergencyContactName: form.emergencyContactName, emergencyContactLastName: form.emergencyContactLastName, emergencyContactPhone: form.emergencyContactPhone, emergencyContactRelation: form.emergencyContactRelation });
      onSave();
      setEditing(false);
      showSaveSuccess();
    } catch {}
    setSaving(false);
  }

  async function handleCoverUpload(file: File) {
    setUploadingCover(true);
    try {
      const res = await api.upload<{ data: { coverImageUrl: string } }>('/api/employees/me/cover', file);
      // Mostramos la portada nueva de inmediato con la URL que devuelve el server.
      setCoverOverride(res.data.coverImageUrl);
      onSave(); // refresca el perfil (y el preview público) en segundo plano
      showSaveSuccess({ title: 'Portada actualizada' });
    } catch {
      alert('No se pudo subir la portada');
    }
    setUploadingCover(false);
  }

  async function handleAvatarUpload(file: File) {
    setUploadingAvatar(true);
    try {
      const res = await api.upload<{ data: { avatarUrl: string } }>('/api/employees/me/avatar', file);
      setAvatarOverride(res.data.avatarUrl);
      onSave();
      showSaveSuccess({ title: 'Foto actualizada' });
    } catch {
      alert('No se pudo subir la foto de perfil');
    }
    setUploadingAvatar(false);
  }

  // URLs efectivas: el override recién subido tiene prioridad sobre el valor del
  // employee (que llega del servidor tras el refetch).
  const effectiveCoverUrl = coverOverride ?? employee.coverImageUrl;
  const effectiveAvatarUrl = avatarOverride ?? employee.avatarUrl;

  return (
    <div className="px-6 py-4 max-w-2xl mx-auto space-y-4">
      {/* Card unificada: portada + info personal en el mismo contenedor. */}
      <div className={`bg-white rounded-xl border overflow-hidden relative ${editing ? 'border-[#008080]' : 'border-gray-200'}`}>
        {/* Banner de portada — aspect vertical 9:16 (mismo que perfil
            publico del marketplace). Solo editable en modo "Editar".
            Sin gap: pegado a los bordes del card. */}
        <div
          className={`relative w-full ${editing ? 'cursor-pointer' : ''} group`}
          style={{
            aspectRatio: '9/16',
            maxHeight: '320px',
            backgroundImage: effectiveCoverUrl ? `url(${API_URL}${effectiveCoverUrl})` : undefined,
            backgroundColor: effectiveCoverUrl ? undefined : (form.color || employee.color || '#008080'),
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          onClick={() => { if (editing && !uploadingCover) coverFileInputRef.current?.click(); }}
        >
          {editing && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              {uploadingCover ? (
                <div className="animate-spin rounded-full h-7 w-7 border-2 border-white border-t-transparent" />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-white">
                  <svg className="w-8 h-8 drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 2L7.17 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-3.17L15 2H9zm3 15a5 5 0 110-10 5 5 0 010 10zm0-2a3 3 0 100-6 3 3 0 000 6z"/>
                  </svg>
                  <span className="text-xs font-semibold drop-shadow">
                    {effectiveCoverUrl ? 'Cambiar portada' : 'Agregar portada'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        <input
          ref={coverFileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setCoverCropFile(f);
            e.target.value = '';
          }}
        />

        {/* Selector de color del banner — solo cuando editing Y sin foto. */}
        {editing && !effectiveCoverUrl && (
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Color del banner</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map((c) => {
                const active = form.color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${active ? 'scale-110' : 'hover:scale-105'}`}
                    style={{
                      backgroundColor: c,
                      borderColor: active ? '#1f2937' : 'rgba(0,0,0,0.1)',
                    }}
                    aria-label={`Color ${c}`}
                  >
                    {active && (
                      <svg className="w-4 h-4 text-white mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Contenido: avatar + nombre + email + telefono + presentacion */}
        <div className="p-5 relative">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="absolute top-4 right-4 flex items-center gap-1.5 text-xs text-[#008080] hover:text-[#006666] font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
              Editar
            </button>
          ) : null}

          <div className="flex items-center gap-4 mb-4">
          {/* Avatar — overlay con icono camara cuando editing para indicar
              que se puede cambiar. Click abre file picker. */}
          <div
            className={`relative w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold text-white flex-shrink-0 ${editing ? 'cursor-pointer group' : ''}`}
            style={{ backgroundColor: employee.color || '#008080' }}
            onClick={() => { if (editing && !uploadingAvatar) avatarFileInputRef.current?.click(); }}
          >
            {effectiveAvatarUrl ? <img src={`${API_URL}${effectiveAvatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{employee.firstName[0]}{employee.lastName[0]}</>}
            {editing && (
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                {uploadingAvatar ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 2L7.17 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-3.17L15 2H9zm3 15a5 5 0 110-10 5 5 0 010 10zm0-2a3 3 0 100-6 3 3 0 000 6z"/>
                  </svg>
                )}
              </div>
            )}
          </div>
          <input
            ref={avatarFileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setAvatarCropFile(f);
              e.target.value = '';
            }}
          />
          <div>
            <p className="font-semibold text-gray-900">{employee.firstName} {employee.lastName}</p>
            {employee.jobTitle && <p className="text-xs text-[#008080] font-medium">{employee.jobTitle}</p>}
          </div>
        </div>

        {!editing ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-400 mb-0.5">Email</p><p className="text-sm text-gray-700">{employee.email || '—'}</p></div>
              <div><p className="text-xs text-gray-400 mb-0.5">Teléfono</p><p className="text-sm text-gray-700">{employee.phone || '—'}</p></div>
            </div>
            {employee.bio && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-0.5">Presentación</p>
                <p className="text-sm text-gray-700">{employee.bio}</p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label><input type="text" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label><input type="text" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className="input-field" /></div>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label><input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input-field" /></div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Presentación</label>
              <p className="text-[11px] text-gray-400 mb-1.5 leading-relaxed">
                Cuéntale a tus clientes quién eres, tu experiencia y especialidades. Este texto aparece en tu perfil público del marketplace.
              </p>
              <textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} className="input-field resize-none" rows={4} placeholder="Ej: Estilista con 8 años de experiencia, especializada en colorimetría y cortes modernos…" />
            </div>
          </div>
        )}
      </div>

      {/* Medical info */}
      <div className={`bg-white rounded-xl border p-5 ${editing ? 'border-[#008080]' : 'border-gray-200'}`}>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Información médica</h3>
        {!editing ? (
          <div><p className="text-xs text-gray-400 mb-0.5">Alergias</p><p className="text-sm text-gray-700">{employee.allergies || 'Ninguna conocida'}</p></div>
        ) : (
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Alergias <span className="text-[10px] text-gray-400 font-normal">(opcional)</span></label><input type="text" value={form.allergies} onChange={(e) => setForm((f) => ({ ...f, allergies: e.target.value }))} className="input-field" /></div>
        )}
      </div>

      {/* Emergency contact */}
      <div className={`bg-white rounded-xl border p-5 ${editing ? 'border-[#008080]' : 'border-gray-200'}`}>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Contacto de emergencia</h3>
        {!editing ? (
          employee.emergencyContactName || employee.emergencyContactPhone ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-400 mb-0.5">Nombre</p><p className="text-sm text-gray-700">{employee.emergencyContactName || '—'} {employee.emergencyContactLastName || ''}</p></div>
              <div><p className="text-xs text-gray-400 mb-0.5">Teléfono</p><p className="text-sm text-gray-700">{employee.emergencyContactPhone || '—'}</p></div>
              <div><p className="text-xs text-gray-400 mb-0.5">Relación</p><p className="text-sm text-gray-700">{employee.emergencyContactRelation || '—'}</p></div>
            </div>
          ) : <p className="text-sm text-gray-400">Sin contacto de emergencia registrado</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label><input type="text" value={form.emergencyContactName} onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label><input type="text" value={form.emergencyContactLastName} onChange={(e) => setForm((f) => ({ ...f, emergencyContactLastName: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label><input type="tel" value={form.emergencyContactPhone} onChange={(e) => setForm((f) => ({ ...f, emergencyContactPhone: e.target.value }))} className="input-field" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Relación</label><select value={form.emergencyContactRelation} onChange={(e) => setForm((f) => ({ ...f, emergencyContactRelation: e.target.value }))} className="input-field"><option value="">—</option>{RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
          </div>
        )}
        </div>{/* fin p-5 contenido */}
      </div>{/* fin card unificada */}

      {/* Save/Cancel buttons */}
      {editing && (
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#008080' }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">Cancelar</button>
        </div>
      )}

      {/* Crop modals */}
      {coverCropFile && (
        <CoverCropModal
          imageFile={coverCropFile}
          aspect="portrait"
          onCancel={() => setCoverCropFile(null)}
          onChooseAnother={() => {
            setCoverCropFile(null);
            coverFileInputRef.current?.click();
          }}
          onAccept={(cropped) => {
            setCoverCropFile(null);
            handleCoverUpload(cropped);
          }}
        />
      )}
      {avatarCropFile && (
        <AvatarCropModal
          imageFile={avatarCropFile}
          onCancel={() => setAvatarCropFile(null)}
          onChooseAnother={() => {
            setAvatarCropFile(null);
            avatarFileInputRef.current?.click();
          }}
          onAccept={(cropped) => {
            setAvatarCropFile(null);
            handleAvatarUpload(cropped);
          }}
        />
      )}
    </div>
  );
}
