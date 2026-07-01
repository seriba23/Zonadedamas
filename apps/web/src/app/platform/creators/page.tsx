'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '@/lib/platform-auth';
import { Modal } from '@/components/ui/modal';

type InfluencerStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED';

interface Influencer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: InfluencerStatus;
  approvedAt: string | null;
  stripeOnboardingComplete: boolean;
  notes: string | null;
  createdAt: string;
  activeCode: string | null;
  codesCount: number;
  payoutsCount: number;
}

interface ListResponse {
  data: Influencer[];
  meta: { total: number; page: number; perPage: number; totalPages: number };
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'APPROVED', label: 'Aprobados' },
  { value: 'SUSPENDED', label: 'Suspendidos' },
];

const STATUS_META: Record<InfluencerStatus, { label: string; dot: string; badge: string }> = {
  PENDING: { label: 'Pendiente', dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600 border-gray-200' },
  APPROVED: { label: 'Aprobado', dot: 'bg-teal-500', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  SUSPENDED: { label: 'Suspendido', dot: 'bg-red-500', badge: 'bg-red-50 text-red-600 border-red-200' },
};

const AVATAR_COLORS = ['#008080', '#0d9488', '#0891b2', '#7c3aed', '#db2777', '#e11d48', '#ea580c', '#16a34a'];
function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
// WhatsApp espera formato internacional; el teléfono se captura a 10 dígitos (MX -> 52)
function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `52${digits}` : digits;
}

export default function CreatorsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', phone: '', notes: '' });
  const [formError, setFormError] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-influencers', statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const qs = params.toString();
      return platformApi.get<ListResponse>(`/api/platform/influencers${qs ? `?${qs}` : ''}`);
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['platform-influencers'] });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => platformApi.post('/api/platform/influencers', body),
    onSuccess: () => {
      invalidate();
      setShowCreate(false);
      setForm({ email: '', firstName: '', lastName: '', phone: '', notes: '' });
      setFormError('');
    },
    onError: (err: any) => setFormError(err?.message || 'No se pudo crear el creador'),
  });

  const runPayoutsMutation = useMutation({
    mutationFn: () => platformApi.post<{ data: any }>('/api/platform/influencers/payouts/run'),
    onSuccess: (res: any) => {
      const d = res?.data || {};
      alert(`Comisiones procesadas (${d.forMonth}): pagadas=${d.paid ?? 0}, pendientes=${d.pending ?? 0}, perdidos=${d.lost ?? 0}`);
      invalidate();
    },
    onError: (err: any) => alert(err?.message || 'No se pudo correr las comisiones'),
  });

  const influencers = data?.data || [];
  const activeFilterCount = statusFilter ? 1 : 0;

  function submitCreate() {
    if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      setFormError('Email, nombre y apellido son obligatorios');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setFormError('Ingresa un email válido');
      return;
    }
    if (form.phone && !/^\d{10}$/.test(form.phone)) {
      setFormError('El teléfono debe tener exactamente 10 dígitos, sin espacios');
      return;
    }
    createMutation.mutate({ ...form, email: form.email.trim() });
  }

  function copyCode(e: React.MouseEvent, id: string, code: string) {
    e.stopPropagation();
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1800);
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reclutadores y creadores de contenido</h1>
          <p className="text-sm text-gray-500 mt-1">
            Toca una tarjeta para ver el detalle, sus clientes y todas las acciones.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
          <a
            href="/creator/login"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Portal
          </a>
          <button
            onClick={() => {
              if (confirm('Procesar las comisiones del mes ahora?')) runPayoutsMutation.mutate();
            }}
            disabled={runPayoutsMutation.isPending}
            className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {runPayoutsMutation.isPending ? 'Procesando...' : 'Correr comisiones'}
          </button>
          <button
            onClick={() => { setShowCreate(true); setFormError(''); }}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg"
            style={{ backgroundColor: '#008080' }}
          >
            + Agregar
          </button>
        </div>
      </div>

      {/* Buscador + filtros */}
      <div className="flex items-center gap-2 mb-5">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o código..."
            className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center"
              aria-label="Limpiar"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          aria-label="Filtros"
          className={`shrink-0 p-2.5 rounded-lg border transition-colors ${
            activeFilterCount
              ? 'bg-[#008080] border-[#008080] text-white'
              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      </div>

      {/* Tarjetas */}
      {isLoading ? (
        <div className="p-8 text-center text-gray-400">Cargando...</div>
      ) : influencers.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
          No hay reclutadores que coincidan.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {influencers.map((inf) => {
            const meta = STATUS_META[inf.status];
            return (
              <div
                key={inf.id}
                onClick={() => setDetailId(inf.id)}
                className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md hover:border-teal-200 transition-all"
              >
                {/* Identidad */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                    style={{ backgroundColor: avatarColor(inf.id) }}
                  >
                    {initials(inf.firstName, inf.lastName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{inf.firstName} {inf.lastName}</p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </div>
                </div>

                {/* Contacto con íconos */}
                <div className="flex items-center gap-2 mt-3">
                  <a
                    href={`mailto:${inf.email}`}
                    onClick={(e) => e.stopPropagation()}
                    title={inf.email}
                    className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-[#008080] flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </a>
                  {inf.phone && (
                    <>
                      <a
                        href={`https://wa.me/${waNumber(inf.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={`WhatsApp ${inf.phone}`}
                        className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-green-50 hover:text-green-600 flex items-center justify-center"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.748-.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                        </svg>
                      </a>
                      <a
                        href={`tel:${inf.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        title={`Llamar ${inf.phone}`}
                        className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-[#008080] flex items-center justify-center"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </a>
                    </>
                  )}
                </div>

                {/* Código */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  {inf.activeCode ? (
                    <>
                      <span className="font-mono text-sm font-semibold text-teal-700">{inf.activeCode}</span>
                      <button
                        onClick={(e) => copyCode(e, inf.id, inf.activeCode!)}
                        className={`text-xs font-medium px-2 py-1 rounded-lg border ${
                          copiedId === inf.id ? 'border-teal-200 text-teal-700 bg-teal-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {copiedId === inf.id ? '¡Copiado!' : 'Copiar'}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">Sin código (aprueba para generar)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data?.meta && !isLoading && (
        <p className="text-xs text-gray-400 mt-3">{data.meta.total} reclutador(es) en total.</p>
      )}

      {/* Modal de filtros */}
      {showFilters && (
        <Modal title="Filtros" onClose={() => setShowFilters(false)} size="sm">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Estado</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((f) => {
                  const active = statusFilter === f.value;
                  return (
                    <button
                      key={f.value}
                      onClick={() => setStatusFilter(f.value)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        active ? 'bg-[#008080] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStatusFilter('')}
                className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Limpiar
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="flex-1 py-2 text-sm font-medium text-white rounded-lg"
                style={{ backgroundColor: '#008080' }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal alta */}
      {showCreate && (
        <Modal title="Agregar reclutador / creador" onClose={() => setShowCreate(false)} size="md">
          <p className="text-xs text-gray-500 mb-4">
            Se registra como pendiente. Apruébalo en su detalle para generar su código.
          </p>
          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email *"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Nombre *"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]"
              />
              <input
                type="text"
                placeholder="Apellido *"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]"
              />
            </div>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="Teléfono (10 dígitos, opcional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]"
            />
            {form.phone.length > 0 && form.phone.length < 10 && (
              <p className="text-[11px] text-gray-400 -mt-1">{form.phone.length}/10 dígitos</p>
            )}
            <textarea
              placeholder="Notas internas (opcional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080] resize-none"
            />
          </div>
          {formError && <p className="text-xs text-red-500 mt-3">{formError}</p>}
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={submitCreate}
              disabled={createMutation.isPending}
              className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
              style={{ backgroundColor: '#008080' }}
            >
              {createMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal detalle */}
      {detailId && (
        <CreatorDetailModal influencerId={detailId} onClose={() => setDetailId(null)} onChanged={invalidate} />
      )}
    </div>
  );
}

// ─── Detalle del reclutador (todas las acciones) ────

const STATE_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVO: { label: 'Nuevo (descuento)', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  PAGANDO: { label: 'Pagando comisión', className: 'bg-teal-50 text-teal-700 border-teal-200' },
  EN_RIESGO: { label: 'En riesgo', className: 'bg-red-50 text-red-600 border-red-200' },
  PERDIDO: { label: 'Perdido', className: 'bg-gray-100 text-gray-400 border-gray-200' },
};

function money(n: number) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('es-MX');
}

function CreatorDetailModal({
  influencerId,
  onClose,
  onChanged,
}: {
  influencerId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [accessResult, setAccessResult] = useState<{ kind: 'password' | 'link'; value: string } | null>(null);
  const [onboardLink, setOnboardLink] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-influencer-detail', influencerId],
    queryFn: () => platformApi.get<{ data: any }>(`/api/platform/influencers/${influencerId}`),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['platform-influencer-detail', influencerId] });
    onChanged();
  };

  const approve = useMutation({ mutationFn: () => platformApi.post(`/api/platform/influencers/${influencerId}/approve`), onSuccess: refresh, onError: (e: any) => alert(e?.message) });
  const suspend = useMutation({ mutationFn: () => platformApi.post(`/api/platform/influencers/${influencerId}/suspend`), onSuccess: refresh });
  const reactivate = useMutation({ mutationFn: () => platformApi.post(`/api/platform/influencers/${influencerId}/reactivate`), onSuccess: refresh });
  const remove = useMutation({ mutationFn: () => platformApi.delete(`/api/platform/influencers/${influencerId}`), onSuccess: () => { onChanged(); onClose(); }, onError: (e: any) => alert(e?.message || 'No se pudo eliminar') });
  const genPassword = useMutation({ mutationFn: () => platformApi.post<{ data: any }>(`/api/platform/influencers/${influencerId}/access/generate-password`), onSuccess: (r: any) => setAccessResult({ kind: 'password', value: r?.data?.tempPassword }) });
  const inviteLink = useMutation({ mutationFn: () => platformApi.post<{ data: any }>(`/api/platform/influencers/${influencerId}/access/invite-link`), onSuccess: (r: any) => setAccessResult({ kind: 'link', value: r?.data?.url }) });
  const onboard = useMutation({ mutationFn: () => platformApi.post<{ data: any }>(`/api/platform/influencers/${influencerId}/stripe/onboarding-link`), onSuccess: (r: any) => setOnboardLink(r?.data?.url ?? null), onError: (e: any) => alert(e?.message) });
  const refreshStripe = useMutation({ mutationFn: () => platformApi.get(`/api/platform/influencers/${influencerId}/stripe/status`), onSuccess: refresh });
  const retry = useMutation({ mutationFn: () => platformApi.post<{ data: any }>(`/api/platform/influencers/${influencerId}/payouts/retry`), onSuccess: (r: any) => { alert(`Reintento: ${r?.data?.paid ?? 0}/${r?.data?.retried ?? 0} transfers`); refresh(); } });

  const inf = data?.data?.influencer;
  const totals = data?.data?.totals;
  const sc = data?.data?.stateCounts;
  const clients = data?.data?.clients || [];
  const payouts = data?.data?.payouts || [];
  const code = data?.data?.codes?.[0]?.code;

  // Envía por WhatsApp la bienvenida a Siliba Creadores + su enlace de acceso
  // (para crear contraseña) + su código. Genera el enlace de acceso al vuelo.
  // Abrimos una pestaña en blanco de inmediato (gesto del usuario) y la
  // redirigimos a wa.me cuando el enlace está listo, para no ser bloqueados.
  function sendWelcome() {
    if (!inf?.phone) { alert('Este reclutador no tiene teléfono registrado.'); return; }
    const win = window.open('', '_blank');
    inviteLink.mutateAsync()
      .then((r: any) => {
        const url = r?.data?.url || '';
        const msg =
          `¡Hola ${inf.firstName}!\n` +
          `Te damos la bienvenida a *Siliba Creadores*.\n\n` +
          `Ya estás dado de alta. Crea tu contraseña y entra a tu panel aquí:\n${url}` +
          (code ? `\n\nTu código para compartir es: *${code}*` : '') +
          `\n\nDesde tu panel podrás ver tus referidos y tus comisiones. ¡Bienvenido!`;
        const waUrl = `https://wa.me/${waNumber(inf.phone)}?text=${encodeURIComponent(msg)}`;
        if (win) win.location.href = waUrl;
        else window.open(waUrl, '_blank');
      })
      .catch((e: any) => { win?.close(); alert(e?.message || 'No se pudo generar el enlace de acceso'); });
  }

  return (
    <Modal title="Detalle del reclutador" onClose={onClose} size="lg">
      {isLoading || !inf ? (
        <div className="py-12 text-center text-gray-400">Cargando detalle...</div>
      ) : (
        <div>
          {/* Identidad + estado */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold shrink-0" style={{ backgroundColor: avatarColor(inf.id) }}>
              {initials(inf.firstName, inf.lastName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-gray-900">{inf.firstName} {inf.lastName}</p>
              <p className="text-xs text-gray-500 truncate">{inf.email}{inf.phone ? ` · ${inf.phone}` : ''}</p>
            </div>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_META[inf.status as InfluencerStatus].badge}`}>
              {STATUS_META[inf.status as InfluencerStatus].label}
            </span>
          </div>

          {/* Acciones de estado */}
          <div className="flex flex-wrap gap-2 mb-4">
            {inf.status === 'PENDING' && (
              <button onClick={() => approve.mutate()} disabled={approve.isPending} className="text-xs font-medium text-white px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ backgroundColor: '#008080' }}>
                {approve.isPending ? '...' : 'Aprobar y generar código'}
              </button>
            )}
            {inf.status === 'APPROVED' && (
              <button
                onClick={sendWelcome}
                disabled={inviteLink.isPending || !inf.phone}
                title={inf.phone ? 'Enviar bienvenida y enlace de acceso por WhatsApp' : 'Sin teléfono registrado'}
                className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50"
                style={{ backgroundColor: '#25D366' }}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                {inviteLink.isPending ? 'Preparando...' : 'Enviar bienvenida'}
              </button>
            )}
            {inf.status === 'APPROVED' && (
              <button onClick={() => suspend.mutate()} disabled={suspend.isPending} className="text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">Suspender</button>
            )}
            {inf.status === 'SUSPENDED' && (
              <button onClick={() => reactivate.mutate()} disabled={reactivate.isPending} className="text-xs font-medium text-teal-700 border border-teal-200 px-3 py-1.5 rounded-lg hover:bg-teal-50 disabled:opacity-50">Reactivar</button>
            )}
            {totals?.referredClients === 0 && (
              <button
                onClick={() => { if (confirm(`¿Eliminar a ${inf.firstName} ${inf.lastName}?`)) remove.mutate(); }}
                disabled={remove.isPending}
                className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5 disabled:opacity-50"
              >
                Eliminar
              </button>
            )}
          </div>

          {/* Código */}
          {code && (
            <div className="mb-4 p-3 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-gray-500">Código de referido</p>
                <span className="font-mono text-lg font-black text-teal-700">{code}</span>
              </div>
              <button onClick={() => navigator.clipboard?.writeText(code).catch(() => {})} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white">Copiar</button>
            </div>
          )}

          {/* Totales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Stat label="Referidos" value={String(totals.referredClients)} />
            <Stat label="Acumulado" value={money(totals.accrued)} />
            <Stat label="Pagado" value={money(totals.paid)} teal />
            <Stat label="Pendiente" value={money(totals.pending)} />
          </div>

          {/* Conteo por estado */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(['ACTIVO', 'PAGANDO', 'EN_RIESGO', 'PERDIDO'] as const).map((s) => (
              <span key={s} className={`text-[11px] font-medium px-2 py-1 rounded-full border ${STATE_BADGE[s].className}`}>
                {STATE_BADGE[s].label}: {sc[s] || 0}
              </span>
            ))}
          </div>

          {/* Cobros (Stripe) */}
          <div className="mb-4 p-3 rounded-xl border border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700">Cobros (Stripe)</p>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${inf.stripeOnboardingComplete ? 'text-teal-700' : 'text-gray-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${inf.stripeOnboardingComplete ? 'bg-teal-500' : 'bg-gray-400'}`} />
                {inf.stripeOnboardingComplete ? 'Activos' : 'Sin configurar'}
              </span>
            </div>
            {onboardLink ? (
              <div className="flex items-center gap-2">
                <input readOnly value={onboardLink} onFocus={(e) => e.target.select()} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white truncate" />
                <button onClick={() => navigator.clipboard?.writeText(onboardLink).catch(() => {})} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white shrink-0">Copiar</button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {inf.status === 'APPROVED' && (
                  <button onClick={() => onboard.mutate()} disabled={onboard.isPending} className="text-xs font-medium text-white px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ backgroundColor: '#008080' }}>
                    {onboard.isPending ? '...' : 'Generar link de cobros'}
                  </button>
                )}
                <button onClick={() => refreshStripe.mutate()} disabled={refreshStripe.isPending} className="text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-white disabled:opacity-50">Verificar estado</button>
                {totals.pending > 0 && inf.stripeOnboardingComplete && (
                  <button onClick={() => retry.mutate()} disabled={retry.isPending} className="text-xs font-medium text-teal-700 border border-teal-200 px-3 py-1.5 rounded-lg hover:bg-teal-50 disabled:opacity-50">Reintentar pagos ({money(totals.pending)})</button>
                )}
              </div>
            )}
          </div>

          {/* Acceso al panel */}
          <div className="mb-4 p-3 rounded-xl border border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-700 mb-2">Acceso al panel del creador</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => genPassword.mutate()} disabled={genPassword.isPending} className="text-xs font-medium text-white px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ backgroundColor: '#008080' }}>Generar contraseña</button>
              <button onClick={() => inviteLink.mutate()} disabled={inviteLink.isPending} className="text-xs font-medium text-teal-700 border border-teal-200 px-3 py-1.5 rounded-lg hover:bg-teal-50 disabled:opacity-50">Generar link de invitación</button>
            </div>
            {accessResult && (
              <div className="mt-3">
                <p className="text-[11px] text-gray-500 mb-1">
                  {accessResult.kind === 'password' ? 'Contraseña temporal (cópiala, no se vuelve a mostrar):' : 'Link de invitación (válido 7 días):'}
                </p>
                <div className="flex items-center gap-2">
                  <input readOnly value={accessResult.value} onFocus={(e) => e.target.select()} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-mono bg-white truncate" />
                  <button onClick={() => navigator.clipboard?.writeText(accessResult.value).catch(() => {})} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white shrink-0">Copiar</button>
                </div>
              </div>
            )}
          </div>

          {/* Clientes referidos */}
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Clientes referidos</h3>
          {clients.length === 0 ? (
            <p className="text-xs text-gray-400 py-3">Aún no hay negocios que hayan usado su código.</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden mb-4">
              {clients.map((c: any) => {
                const badge = STATE_BADGE[c.state] || STATE_BADGE.ACTIVO;
                return (
                  <li key={c.usageId} className="px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.tenantName}</p>
                      <p className="text-[11px] text-gray-400">{c.monthsActive} mes(es) · {c.commissionsCount} comisión(es) · {money(c.commissionsSum)}</p>
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${badge.className}`}>{badge.label}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Historial de comisiones */}
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Historial de comisiones</h3>
          {payouts.length === 0 ? (
            <p className="text-xs text-gray-400 py-3">Sin comisiones generadas todavía.</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {payouts.map((p: any) => (
                <li key={p.id} className="px-3 py-2 flex items-center justify-between text-sm">
                  <span className="text-gray-700">{p.forMonth}</span>
                  <span className="font-medium text-gray-900 tabular-nums">{money(p.amount)}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${p.transferred ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.transferred ? 'Transferido' : 'Pendiente'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, teal }: { label: string; value: string; teal?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${teal ? 'border-teal-100 bg-teal-50' : 'border-gray-100 bg-gray-50'}`}>
      <p className={`text-[11px] ${teal ? 'text-teal-700' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-lg font-black tabular-nums whitespace-nowrap ${teal ? 'text-teal-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
