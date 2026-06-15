'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Modal } from '@/components/ui/modal';
import { formatCurrency } from '@/lib/utils';
import { useRegisterTopbarAction } from '@/lib/hooks/use-topbar-action';
import { KpiCard } from '@/components/dashboard/kpi-card';

interface RedemptionSummary {
  totalAll: number;
  totalActive: number;
  totalUsed: number;
  totalExpired: number;
  totalGifts: number;
  totalRedeemed: number;
  totalPointsSpent: number;
}

function CouponStatsBar() {
  const { data } = useQuery({
    queryKey: ['coupon-summary'],
    queryFn: () =>
      api.get<{ meta: { summary: RedemptionSummary } }>(
        '/api/rewards/redemptions/all?page=1&perPage=1',
      ),
  });
  const s = data?.meta?.summary;
  if (!s) return null;
  const icon = (path: string) => (
    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
      <KpiCard icon={icon('M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z')} label="Total emitidos" value={s.totalAll} />
      <KpiCard icon={icon('M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z')} label="Activos" value={s.totalActive} />
      <KpiCard icon={icon('M4.5 12.75l6 6 9-13.5')} label="Usados" value={s.totalUsed} />
      <KpiCard icon={icon('M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z')} label="Vencidos" value={s.totalExpired} />
      <KpiCard icon={icon('M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z')} label="Regalados / Canjeados" value={`${s.totalGifts} / ${s.totalRedeemed}`} />
      <KpiCard icon={icon('M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z')} label="Puntos cobrados" value={s.totalPointsSpent.toLocaleString()} />
    </div>
  );
}


interface Reward {
  id: string;
  name: string;
  description?: string;
  type: 'SERVICIO' | 'DESCUENTO' | 'TWO_FOR_ONE';
  pointsRequired: number;
  serviceId?: string | null;
  serviceIds?: string[] | null;
  discountAmount?: number;
  discountMode?: 'FLAT' | 'PERCENTAGE';
  code?: string | null;
  minAmount?: number | null;
  allowPointPayment?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  maxRedemptions?: number;
  timesRedeemed: number;
  validUntil?: string;
  service?: { id: string; name: string; price: number };
}

interface RewardForm {
  name: string;
  description: string;
  type: 'SERVICIO' | 'DESCUENTO' | 'TWO_FOR_ONE';
  pointsRequired: number | string;
  serviceIds: string[]; // multi-select; vacio = todos los servicios
  discountAmount: number | string;
  discountMode: 'FLAT' | 'PERCENTAGE';
  code: string;
  minAmount: number | string;
  allowPointPayment: boolean;
  isActive: boolean;
  maxRedemptions: number | string;
  validUntil: string;
}

interface ServiceOption {
  id: string;
  name: string;
  price: number;
}

const defaultForm: RewardForm = {
  name: '',
  description: '',
  type: 'SERVICIO',
  pointsRequired: '',
  serviceIds: [],
  discountAmount: '',
  discountMode: 'PERCENTAGE',
  code: '',
  minAmount: '',
  allowPointPayment: true,
  isActive: true,
  maxRedemptions: '',
  validUntil: '',
};

// Multi-select de servicios con buscador. Selección vacia significa "todos
// los servicios" — se interpreta como "el cupon aplica a cualquiera del
// catalogo del tenant".
function ServicesMultiSelect({
  services,
  value,
  onChange,
}: {
  services: ServiceOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? services.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : services;
  const selectedSet = new Set(value);
  const selectedNames = services
    .filter((s) => selectedSet.has(s.id))
    .map((s) => s.name);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const summary = value.length === 0
    ? 'Todos los servicios'
    : value.length === 1
      ? selectedNames[0] || '1 servicio'
      : `${value.length} servicios seleccionados`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input-field text-left flex items-center justify-between w-full"
      >
        <span className={value.length === 0 ? 'text-gray-500' : 'text-gray-900'}>{summary}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          {/* Backdrop para cerrar */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-hidden flex flex-col">
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar servicio…"
                className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008080]/30"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${value.length === 0 ? 'bg-teal-50' : ''}`}
              >
                <span className={value.length === 0 ? 'font-semibold text-[#008080]' : 'text-gray-700'}>
                  Todos los servicios
                </span>
                {value.length === 0 && (
                  <svg className="w-4 h-4 text-[#008080]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-xs text-gray-400 text-center">Sin resultados</p>
              ) : (
                filtered.map((svc) => {
                  const isSel = selectedSet.has(svc.id);
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => toggle(svc.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${isSel ? 'bg-teal-50' : ''}`}
                    >
                      <span className={isSel ? 'font-medium text-[#008080]' : 'text-gray-700'}>
                        {svc.name}
                      </span>
                      {isSel && (
                        <svg className="w-4 h-4 text-[#008080]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            {value.length > 0 && (
              <div className="p-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">{value.length} seleccionado(s)</span>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[11px] text-red-600 hover:underline font-medium"
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function RewardsContent({ embedded }: { embedded?: boolean } = {}) {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [form, setForm] = useState<RewardForm>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [couponModal, setCouponModal] = useState<{ open: boolean; code: string }>({ open: false, code: '' });
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [giftModal, setGiftModal] = useState(false);
  const [giftRewardId, setGiftRewardId] = useState('');
  const [giftClientIds, setGiftClientIds] = useState<string[]>([]);
  const [giftSuccess, setGiftSuccess] = useState<string | null>(null);
  // Confirmacion intermedia antes de disparar el loop de envios. Evita que
  // el admin regale por accidente.
  const [giftConfirm, setGiftConfirm] = useState<{
    rewardId: string;
    rewardName: string;
    clientIds: string[];
    clientNames: string[];
  } | null>(null);
  const [giftSending, setGiftSending] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  // Tab activo: "catalogo" muestra los rewards del tenant; "historial" muestra
  // todos los RewardRedemptions emitidos con filtros para auditoria.
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  // Filtros del catalogo (tipo + estado activo/inactivo). draft = lo
  // que se edita en el modal; al pulsar "Aplicar" pasa al state real.
  const [filterType, setFilterType] = useState<'' | 'SERVICIO' | 'DESCUENTO' | 'TWO_FOR_ONE'>('');
  const [filterActive, setFilterActive] = useState<'' | 'active' | 'inactive'>('');
  const [draftType, setDraftType] = useState<'' | 'SERVICIO' | 'DESCUENTO' | 'TWO_FOR_ONE'>('');
  const [draftActive, setDraftActive] = useState<'' | 'active' | 'inactive'>('');
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = filterType !== '' || filterActive !== '';
  function openFilters() {
    setDraftType(filterType);
    setDraftActive(filterActive);
    setShowFilters(true);
  }
  function applyFilters() {
    setFilterType(draftType);
    setFilterActive(draftActive);
    setShowFilters(false);
  }
  function clearDraftFilters() {
    setDraftType('');
    setDraftActive('');
  }

  // Topbar: solo el boton "Nuevo" en el catalogo (izquierda del bell).
  // El toggle de estadisticas va dentro del body, junto al subtitulo,
  // porque las stats son contextuales a esta pagina y conviene tener el
  // disparador cerca del contenido.
  useRegisterTopbarAction(
    hasPermission('rewards.create') || hasPermission('rewards.update') ? (
      <button
        onClick={() => setNewMenuOpen(true)}
        className="px-3 md:px-3.5 py-1.5 text-xs md:text-sm font-semibold rounded-lg bg-[#008080] text-white hover:bg-[#006666] transition-colors whitespace-nowrap"
      >
        Nuevo
      </button>
    ) : null,
    [hasPermission('rewards.create'), hasPermission('rewards.update')],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => api.get<{ data: Reward[]; meta: any }>('/api/rewards?perPage=100'),
  });

  const allRewards = data?.data || [];
  const rewards = allRewards.filter((r) => {
    if (filterType && r.type !== filterType) return false;
    if (filterActive === 'active' && !r.isActive) return false;
    if (filterActive === 'inactive' && r.isActive) return false;
    return true;
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services-for-rewards'],
    queryFn: () => api.get<{ data: ServiceOption[] }>('/api/services'),
  });

  const services = servicesData?.data || [];

  const { data: clientsData } = useQuery({
    queryKey: ['clients-for-gift'],
    queryFn: () => api.get<{ data: Array<{ id: string; firstName: string; lastName: string }> }>('/api/clients?perPage=100'),
  });
  const clients = clientsData?.data || [];

  const giftMutation = useMutation({
    mutationFn: () => api.post('/api/rewards/gift', { rewardId: giftRewardId, clientId: giftClientId }),
    onSuccess: (res: any) => {
      setGiftSuccess(`Cupón ${res?.data?.code || ''} enviado exitosamente`);
      setGiftRewardId('');
      setGiftClientId('');
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => {
      if (editingReward) {
        return api.put(`/api/rewards/${editingReward.id}`, payload);
      }
      return api.post('/api/rewards', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      closeModal();
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al guardar el cupón');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/rewards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
    },
  });

  const useCouponMutation = useMutation({
    mutationFn: (code: string) => api.put(`/api/rewards/redemptions/${code}/use`, {}),
    onSuccess: () => {
      setCouponSuccess('Cupón marcado como usado correctamente');
      setCouponError(null);
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
    },
    onError: (err: { message?: string }) => {
      setCouponError(err.message || 'Error al usar el cupón');
      setCouponSuccess(null);
    },
  });

  function openCreate() {
    setEditingReward(null);
    setForm(defaultForm);
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEdit(reward: Reward) {
    setEditingReward(reward);
    // Hidrata el multi-select desde cualquiera de los dos campos del modelo
    // (serviceId singular para SERVICIO o serviceIds array para los demas).
    const ids: string[] = [];
    if (reward.serviceId) ids.push(reward.serviceId);
    if (Array.isArray(reward.serviceIds)) {
      for (const id of reward.serviceIds) {
        if (!ids.includes(id)) ids.push(id);
      }
    }
    setForm({
      name: reward.name,
      description: reward.description || '',
      type: reward.type,
      pointsRequired: reward.pointsRequired,
      serviceIds: ids,
      discountAmount: reward.discountAmount ?? '',
      discountMode: reward.discountMode || 'PERCENTAGE',
      code: reward.code || '',
      minAmount: reward.minAmount ?? '',
      allowPointPayment: reward.allowPointPayment ?? true,
      isActive: reward.isActive,
      maxRedemptions: reward.maxRedemptions ?? '',
      validUntil: reward.validUntil ? reward.validUntil.split('T')[0] : '',
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingReward(null);
    setForm(defaultForm);
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('El nombre es requerido');
      return;
    }
    if (!form.pointsRequired || Number(form.pointsRequired) < 1) {
      setFormError('Los puntos requeridos deben ser al menos 1');
      return;
    }

    const payload: Record<string, any> = {
      name: form.name,
      description: form.description || undefined,
      type: form.type,
      pointsRequired: Number(form.pointsRequired),
      isActive: form.isActive,
      maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
      validUntil: form.validUntil || null,
    };

    // Unificamos serviceId / serviceIds en un solo set de servicios:
    // - SERVICIO con 1 servicio: serviceId singular (compat con BD)
    // - SERVICIO con varios servicios o ninguno: serviceIds array
    // - DESCUENTO / TWO_FOR_ONE: serviceIds array siempre
    const selectedIds = form.serviceIds.filter(Boolean);
    if (form.type === 'SERVICIO') {
      if (selectedIds.length === 1) {
        payload.serviceId = selectedIds[0];
        payload.serviceIds = [];
      } else {
        payload.serviceId = null;
        payload.serviceIds = selectedIds; // vacio significa "todos"
      }
      payload.discountAmount = null;
      payload.discountMode = null;
    } else if (form.type === 'DESCUENTO') {
      payload.serviceId = null;
      payload.serviceIds = selectedIds;
      payload.discountAmount = Number(form.discountAmount) || 0;
      payload.discountMode = form.discountMode;
    } else if (form.type === 'TWO_FOR_ONE') {
      // 2x1 requiere serviceIds explicitos (validacion backend)
      if (selectedIds.length === 0) {
        setFormError('Los cupones 2×1 deben tener al menos un servicio asociado');
        return;
      }
      payload.serviceId = null;
      payload.serviceIds = selectedIds;
      payload.discountAmount = null;
      payload.discountMode = null;
    }

    // Campos compartidos por todos los tipos
    payload.code = form.code.trim() || null;
    payload.minAmount = form.minAmount ? Number(form.minAmount) : null;
    payload.allowPointPayment = form.allowPointPayment;

    saveMutation.mutate(payload);
  }

  return (
    <div className={embedded ? '' : 'flex flex-col h-full'}>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {/* Subtitulo + iconos de stats y filtros a la derecha. Los dos
            iconos estan agrupados: stats abre/cierra la barra de KPIs,
            filtros abre modal con tipo + estado. */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <p className="text-sm text-gray-500 flex-1">
            Configura cupones que tus clientes pueden canjear con sus puntos de fidelidad.
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowStats((v) => !v)}
              aria-label="Estadisticas de cupones"
              title={showStats ? 'Ocultar estadisticas' : 'Ver estadisticas'}
              className={`p-2 rounded-lg border transition-colors ${
                showStats
                  ? 'bg-[#008080] border-[#008080] text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={openFilters}
              aria-label="Filtros"
              title="Filtros"
              className={`p-2 rounded-lg border transition-colors ${
                hasActiveFilters
                  ? 'bg-[#008080] border-[#008080] text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>
        </div>

        {showStats && <CouponStatsBar />}

        {isLoading ? (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : rewards.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🎟️</div>
            <p className="text-gray-500 mb-4">No hay cupones configurados</p>
            {hasPermission('rewards.create') && (
              <button onClick={openCreate} className="btn-primary">
                Crear primer cupón
              </button>
            )}
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}
          >
            {rewards.map((reward) => (
              <CouponAdminCard
                key={reward.id}
                reward={reward}
                canEdit={hasPermission('rewards.update')}
                onEdit={() => openEdit(reward)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <Modal
          title={editingReward ? 'Editar Cupón' : 'Nuevo Cupón'}
          onClose={closeModal}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="input-field"
                placeholder="Ej: Corte Gratis"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="input-field resize-none"
                rows={2}
                placeholder="Descripción opcional..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as 'SERVICIO' | 'DESCUENTO' | 'TWO_FOR_ONE',
                    }))
                  }
                  className="input-field"
                >
                  <option value="SERVICIO">Servicio gratis</option>
                  <option value="DESCUENTO">Descuento</option>
                  <option value="TWO_FOR_ONE">2×1 (paga uno, regala uno)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Puntos requeridos *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.pointsRequired}
                  onChange={(e) => setForm((f) => ({ ...f, pointsRequired: e.target.value }))}
                  className="input-field"
                  placeholder="Ej: 500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Servicios vinculados {form.type === 'TWO_FOR_ONE' && <span className="text-red-500">*</span>}
              </label>
              <ServicesMultiSelect
                services={services}
                value={form.serviceIds}
                onChange={(ids) => setForm((f) => ({ ...f, serviceIds: ids }))}
              />
              <p className="text-xs text-gray-400 mt-1">
                {form.type === 'SERVICIO'
                  ? form.serviceIds.length === 0
                    ? 'Dejar vacío significa que el cupón aplica a todos los servicios del catálogo.'
                    : form.serviceIds.length === 1
                      ? 'El servicio que el cliente recibe gratis al canjear.'
                      : 'El cliente podrá usar el cupón en cualquiera de los servicios seleccionados.'
                  : form.type === 'TWO_FOR_ONE'
                    ? 'Servicios donde aplica el 2×1. Al canjear, el cliente recibe un código para regalar el mismo servicio a un amigo.'
                    : 'Servicios donde el cupón se puede aplicar (vacío = todos).'}
              </p>
            </div>

            {form.type === 'TWO_FOR_ONE' && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                <p className="text-xs text-purple-800">
                  <span className="font-semibold">Cómo funciona:</span> al canjear este cupón con puntos, el cliente paga su cita normal y recibe un código único para regalar el mismo servicio a un amigo. El amigo usa el código al reservar y recibe el servicio gratis.
                </p>
              </div>
            )}

            {form.type === 'DESCUENTO' && (
              <div className={`grid gap-3 items-end ${form.discountMode === 'FLAT' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 leading-tight">
                    Valor del descuento *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discountAmount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, discountAmount: e.target.value }))
                    }
                    className="input-field"
                    placeholder="Ej: 10"
                    required={form.type === 'DESCUENTO'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 leading-tight">Modo</label>
                  <select
                    value={form.discountMode}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        discountMode: e.target.value as 'FLAT' | 'PERCENTAGE',
                      }))
                    }
                    className="input-field w-full pr-8 text-sm"
                  >
                    <option value="PERCENTAGE">Porcentaje (%)</option>
                    <option value="FLAT">Monto fijo</option>
                  </select>
                </div>
                {form.discountMode === 'FLAT' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 leading-tight">Moneda</label>
                    <div className="input-field bg-gray-50 text-gray-600 font-medium">MXN</div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código público
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="input-field font-mono"
                  placeholder="Ej: VERANO2026"
                  maxLength={50}
                />
                <p className="text-[11px] text-gray-400 mt-1">Opcional. Útil para promociones con código que el cliente ingresa.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto mínimo de cita
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minAmount}
                  onChange={(e) => setForm((f) => ({ ...f, minAmount: e.target.value }))}
                  className="input-field"
                  placeholder="Sin mínimo"
                />
                <p className="text-[11px] text-gray-400 mt-1">El cupón solo aplica si el total supera este monto.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Máx. canjes
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.maxRedemptions}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maxRedemptions: e.target.value }))
                  }
                  className="input-field"
                  placeholder="Ilimitado"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Válido hasta
                </label>
                <input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, validUntil: e.target.value }))
                  }
                  className="input-field"
                />
              </div>
            </div>

            <label className="flex items-center justify-between cursor-pointer">
              <p className="text-sm font-medium text-gray-700">Combinable con "pagar con puntos"</p>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={form.allowPointPayment}
                  onChange={(e) => setForm((f) => ({ ...f, allowPointPayment: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-300 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <p className="text-sm font-medium text-gray-700">Activo</p>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-300 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
              </div>
            </label>

            <div className="flex justify-end items-center gap-3 pt-2 flex-wrap">
              {editingReward && editingReward.isActive && hasPermission('rewards.delete') && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('¿Desactivar este cupón?')) {
                      deleteMutation.mutate(editingReward.id, {
                        onSuccess: () => closeModal(),
                      });
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {deleteMutation.isPending ? 'Desactivando...' : 'Desactivar'}
                </button>
              )}
              <button type="button" onClick={closeModal} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
                {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Menu "Nuevo": elige entre crear cupon, regalar cupon o usar cupon */}
      {showFilters && (
        <Modal title="Filtros" onClose={() => setShowFilters(false)} size="md">
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Tipo de cupón
              </label>
              <div className="space-y-1.5">
                {[
                  { value: '', label: 'Todos' },
                  { value: 'SERVICIO', label: 'Servicio gratis' },
                  { value: 'DESCUENTO', label: 'Descuento' },
                  { value: 'TWO_FOR_ONE', label: '2×1' },
                ].map((opt) => {
                  const active = draftType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDraftType(opt.value as any)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-between ${
                        active
                          ? 'bg-teal-50 border-teal-200 text-[#008080]'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {active && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Estado
              </label>
              <div className="space-y-1.5">
                {[
                  { value: '', label: 'Todos' },
                  { value: 'active', label: 'Activos' },
                  { value: 'inactive', label: 'Inactivos' },
                ].map((opt) => {
                  const active = draftActive === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDraftActive(opt.value as any)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-between ${
                        active
                          ? 'bg-teal-50 border-teal-200 text-[#008080]'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {active && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={clearDraftFilters}
                disabled={draftType === '' && draftActive === ''}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  draftType !== '' || draftActive !== ''
                    ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Limpiar
              </button>
              <button
                onClick={applyFilters}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#008080] text-white hover:bg-[#006666] transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {newMenuOpen && (
        <Modal title="Nuevo" onClose={() => setNewMenuOpen(false)}>
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-3">
              ¿Que accion quieres hacer?
            </p>
            {hasPermission('rewards.create') && (
              <button
                type="button"
                onClick={() => { setNewMenuOpen(false); openCreate(); }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-teal-50 text-[#008080] flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Crear nuevo cupon</p>
                  <p className="text-xs text-gray-500">Configura un cupon que tus clientes podran canjear con puntos.</p>
                </div>
              </button>
            )}
            {hasPermission('rewards.create') && (
              <button
                type="button"
                onClick={() => { setNewMenuOpen(false); setGiftModal(true); setGiftSuccess(null); }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-teal-50 text-[#008080] flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Regalar cupon</p>
                  <p className="text-xs text-gray-500">Otorga un cupon directamente a uno o varios clientes sin que paguen puntos.</p>
                </div>
              </button>
            )}
            {hasPermission('rewards.update') && (
              <button
                type="button"
                onClick={() => {
                  setNewMenuOpen(false);
                  setCouponModal({ open: true, code: '' });
                  setCouponError(null);
                  setCouponSuccess(null);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-[#008080] hover:bg-teal-50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-teal-50 text-[#008080] flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Usar cupon</p>
                  <p className="text-xs text-gray-500">Marca como usado un cupon presentado por un cliente.</p>
                </div>
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Use Coupon Modal */}
      {couponModal.open && (
        <Modal title="Usar Cupón" onClose={() => setCouponModal({ open: false, code: '' })}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Ingresa el código del cupón del cliente para marcarlo como usado.
            </p>
            {couponError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{couponError}</div>
            )}
            {couponSuccess && (
              <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">{couponSuccess}</div>
            )}
            <input
              type="text"
              value={couponModal.code}
              onChange={(e) =>
                setCouponModal((p) => ({ ...p, code: e.target.value.toUpperCase() }))
              }
              className="input-field text-center text-lg font-mono tracking-widest"
              placeholder="XXXXXXXX"
              maxLength={12}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCouponModal({ open: false, code: '' })}
                className="btn-secondary"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  if (couponModal.code.trim()) {
                    useCouponMutation.mutate(couponModal.code.trim());
                  }
                }}
                disabled={!couponModal.code.trim() || useCouponMutation.isPending}
                className="btn-primary"
              >
                {useCouponMutation.isPending ? 'Verificando...' : 'Marcar como usado'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Gift coupon modal — multi-client */}
      {giftModal && (
        <Modal title="Regalar cupón a clientes" onClose={() => { setGiftModal(false); setGiftSuccess(null); setGiftClientIds([]); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cupón</label>
              <select
                value={giftRewardId}
                onChange={(e) => setGiftRewardId(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Selecciona un cupón</option>
                {rewards.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.type === 'DESCUENTO' ? 'Descuento' : 'Servicio'}) — {r.pointsRequired} pts</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">Al regalar, no se cobran puntos al cliente</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clientes</label>
              <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                {clients.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={giftClientIds.includes(c.id)}
                      onChange={() => setGiftClientIds((prev) =>
                        prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                      )}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{c.firstName} {c.lastName}</span>
                  </label>
                ))}
                {clients.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">No hay clientes registrados</p>
                )}
              </div>
              {giftClientIds.length > 0 && (
                <p className="text-xs text-[#008080] font-medium mt-1">{giftClientIds.length} cliente{giftClientIds.length !== 1 ? 's' : ''} seleccionado{giftClientIds.length !== 1 ? 's' : ''}</p>
              )}
            </div>
            {giftSuccess && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 font-medium">
                {giftSuccess}
              </div>
            )}
            {giftMutation.isError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
                Error al regalar cupón
              </div>
            )}
            <button
              onClick={() => {
                if (!giftRewardId || giftClientIds.length === 0) return;
                const rw = rewards.find((r) => r.id === giftRewardId);
                const names = clients
                  .filter((c) => giftClientIds.includes(c.id))
                  .map((c) => `${c.firstName} ${c.lastName}`);
                setGiftError(null);
                setGiftConfirm({
                  rewardId: giftRewardId,
                  rewardName: rw?.name || 'Cupón',
                  clientIds: [...giftClientIds],
                  clientNames: names,
                });
              }}
              disabled={!giftRewardId || giftClientIds.length === 0 || giftSending}
              className="btn-primary w-full"
            >
              {`Regalar cupón (${giftClientIds.length})`}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal confirmación regalar cupón.
          Mismo estilo que redeemBizConfirm del marketplace pero con paleta
          morada porque la accion es "regalo". Resume cupón + lista de
          clientes antes de disparar los POST. */}
      {giftConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
          onClick={() => !giftSending && setGiftConfirm(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 bg-purple-50">
              <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-1">
              ¿Regalar este cupón?
            </h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              <span className="font-semibold">{giftConfirm.rewardName}</span>
            </p>
            <div className="rounded-xl p-3 mb-4 bg-purple-50 border border-purple-200">
              <p className="text-xs text-purple-700 text-center mb-2">
                Se enviará a <span className="font-bold">{giftConfirm.clientIds.length}</span> cliente{giftConfirm.clientIds.length !== 1 ? 's' : ''}:
              </p>
              <div className="text-xs text-purple-900 text-center">
                {giftConfirm.clientNames.slice(0, 3).map((n) => (
                  <p key={n} className="truncate">• {n}</p>
                ))}
                {giftConfirm.clientNames.length > 3 && (
                  <p className="text-purple-600 mt-1">y {giftConfirm.clientNames.length - 3} más</p>
                )}
              </div>
            </div>
            <div className="rounded-xl p-3 mb-4 bg-amber-50 border border-amber-200">
              <p className="text-[11px] text-amber-800 text-center">
                El cupón quedará activo <span className="font-semibold">30 días</span> en cada cliente. Esta acción no consume puntos del cliente.
              </p>
            </div>
            {giftError && (
              <div className="rounded-xl p-3 mb-3 bg-red-50 border border-red-200">
                <p className="text-xs text-red-700 text-center">{giftError}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={giftSending}
                onClick={() => setGiftConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={giftSending}
                onClick={async () => {
                  setGiftSending(true);
                  setGiftError(null);
                  let sent = 0;
                  let failed = 0;
                  for (const clientId of giftConfirm.clientIds) {
                    try {
                      await api.post('/api/rewards/gift', { rewardId: giftConfirm.rewardId, clientId });
                      sent++;
                    } catch (err) {
                      failed++;
                      console.error('Error gifting to client:', clientId, err);
                    }
                  }
                  setGiftSending(false);
                  if (sent > 0) {
                    setGiftSuccess(`Cupón enviado a ${sent} cliente${sent !== 1 ? 's' : ''}${failed > 0 ? ` (${failed} fallaron)` : ''}`);
                    setGiftClientIds([]);
                    setGiftConfirm(null);
                    queryClient.invalidateQueries({ queryKey: ['rewards-redemptions'] });
                  } else {
                    setGiftError('No se pudo regalar el cupón a ningún cliente');
                  }
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
              >
                {giftSending ? 'Regalando…' : 'Regalar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatExpiry(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CouponAdminCard({
  reward,
  canEdit,
  onEdit,
}: {
  reward: Reward;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const isDiscount = reward.type === 'DESCUENTO';
  const isTwoForOne = reward.type === 'TWO_FOR_ONE';
  const active = reward.isActive;
  // Morado para 2×1 (mismo look que la vista del cliente); teal por defecto;
  // gris cuando esta inactivo.
  const stubColor = !active ? '#9ca3af' : isTwoForOne ? '#7c3aed' : '#008080';

  // El stub muestra el valor del cupon (lo que el cliente recibe). "GRATIS"
  // solo aplica a SERVICIO (servicio gratis al canjear puntos) y a
  // DESCUENTO con 100% (cita completamente gratis). 2×1 usa su propio
  // label "2×1" porque conceptualmente no es "gratis".
  let valueLabel: string;
  if (isTwoForOne) {
    valueLabel = '2×1';
  } else if (isDiscount) {
    const amt = Number(reward.discountAmount ?? 0);
    if (reward.discountMode === 'PERCENTAGE') {
      valueLabel = amt >= 100 ? 'GRATIS' : `-${amt}%`;
    } else {
      valueLabel = `$${amt}`;
    }
  } else {
    // SERVICIO
    valueLabel = 'GRATIS';
  }
  const subLabel = isTwoForOne ? 'regalo' : isDiscount ? 'descuento' : 'servicio';
  const stubFontSize =
    valueLabel.length <= 4 ? '1.125rem' : valueLabel.length <= 6 ? '0.875rem' : '0.75rem';

  const expiry = formatExpiry(reward.validUntil);

  return (
    <div
      className="relative"
      style={{ opacity: active ? 1 : 0.75, cursor: canEdit ? 'pointer' : 'default' }}
      onClick={() => { if (canEdit) onEdit(); }}
    >
      {/* Card */}
      <div
        className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex"
        style={{ minHeight: 140 }}
      >
        {/* ── Stub izquierdo ── */}
        <div
          className="w-20 flex-shrink-0 flex flex-col items-center justify-center gap-0.5 relative"
          style={{ backgroundColor: stubColor }}
        >
          <span
            className="text-white font-black leading-tight text-center break-all w-full px-2"
            style={{ fontSize: stubFontSize, wordBreak: 'break-all' }}
          >
            {valueLabel}
          </span>
          <span className="text-white/70 text-[9px] uppercase tracking-wider">
            {subLabel}
          </span>

          {/* Perforaciones */}
          <div
            className="absolute -right-3 -top-3 w-6 h-6 rounded-full"
            style={{ backgroundColor: '#f3f4f6' }}
          />
          <div
            className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full"
            style={{ backgroundColor: '#f3f4f6' }}
          />
        </div>

        {/* ── Separador perforado ── */}
        <div className="flex flex-col items-center justify-center w-4 flex-shrink-0 gap-[3px] py-3">
          {Array.from({ length: 11 }).map((_, i) => (
            <div
              key={i}
              className="w-[3px] h-[3px] rounded-full"
              style={{ backgroundColor: '#d1d5db' }}
            />
          ))}
        </div>

        {/* ── Contenido principal ── */}
        <div className="flex-1 py-3 pr-3 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                {reward.name}
              </p>
              {canEdit && (
                <span
                  className="p-1 rounded text-gray-300 flex-shrink-0"
                  title="Click en la tarjeta para editar"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </span>
              )}
            </div>

            {!active && (
              <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-500">
                Inactivo
              </span>
            )}

            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
              {isDiscount
                ? reward.discountMode === 'PERCENTAGE'
                  ? `${Number(reward.discountAmount ?? 0)}% de descuento`
                  : `${formatCurrency(Number(reward.discountAmount ?? 0))} de descuento`
                : reward.service?.name
                  ? `${reward.service.name} gratis`
                  : 'Servicio gratis'}
            </p>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
            {expiry ? (
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0"
                style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
              >
                <svg
                  className="w-3 h-3 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-[10px] font-semibold whitespace-nowrap">
                  Vence {expiry}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-gray-400">
                Canjes: {reward.timesRedeemed}
                {reward.maxRedemptions ? ` / ${reward.maxRedemptions}` : ''}
              </span>
            )}
            <span
              className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-black tracking-wide text-white"
              style={{ backgroundColor: '#008080', letterSpacing: '0.05em' }}
            >
              {reward.pointsRequired} PTS
            </span>
          </div>

          {expiry && (
            <p className="text-[10px] text-gray-400 mt-1">
              Canjes: {reward.timesRedeemed}
              {reward.maxRedemptions ? ` / ${reward.maxRedemptions}` : ''}
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
