'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Modal } from '@/components/ui/modal';
import { formatCurrency } from '@/lib/utils';

interface Reward {
  id: string;
  name: string;
  description?: string;
  type: 'SERVICIO' | 'DESCUENTO';
  pointsRequired: number;
  serviceId?: string;
  discountAmount?: number;
  discountMode?: 'FLAT' | 'PERCENTAGE';
  isActive: boolean;
  maxRedemptions?: number;
  timesRedeemed: number;
  validUntil?: string;
  service?: { id: string; name: string; price: number };
}

interface RewardForm {
  name: string;
  description: string;
  type: 'SERVICIO' | 'DESCUENTO';
  pointsRequired: number | string;
  serviceId: string;
  discountAmount: number | string;
  discountMode: 'FLAT' | 'PERCENTAGE';
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
  serviceId: '',
  discountAmount: '',
  discountMode: 'PERCENTAGE',
  isActive: true,
  maxRedemptions: '',
  validUntil: '',
};

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

  const { data, isLoading } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => api.get<{ data: Reward[]; meta: any }>('/api/rewards?perPage=100'),
  });

  const rewards = data?.data || [];

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
    setForm({
      name: reward.name,
      description: reward.description || '',
      type: reward.type,
      pointsRequired: reward.pointsRequired,
      serviceId: reward.serviceId || '',
      discountAmount: reward.discountAmount ?? '',
      discountMode: reward.discountMode || 'PERCENTAGE',
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

    if (form.type === 'SERVICIO') {
      payload.serviceId = form.serviceId || null;
      payload.discountAmount = null;
      payload.discountMode = null;
    } else {
      payload.serviceId = null;
      payload.discountAmount = Number(form.discountAmount) || 0;
      payload.discountMode = form.discountMode;
    }

    saveMutation.mutate(payload);
  }

  return (
    <div className={embedded ? '' : 'flex flex-col h-full'}>

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            Configura cupones que tus clientes pueden canjear con sus puntos de fidelidad.
          </p>
          <div className="flex gap-2">
            {hasPermission('rewards.update') && (
              <button
                onClick={() => {
                  setCouponModal({ open: true, code: '' });
                  setCouponError(null);
                  setCouponSuccess(null);
                }}
                className="btn-secondary text-sm"
              >
                Usar cupón
              </button>
            )}
            {hasPermission('rewards.create') && (
              <button
                onClick={() => { setGiftModal(true); setGiftSuccess(null); }}
                className="btn-secondary text-sm"
              >
                Regalar cupón
              </button>
            )}
            {hasPermission('rewards.create') && (
              <button onClick={openCreate} className="btn-primary">
                + Nuevo Cupón
              </button>
            )}
          </div>
        </div>

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
                      type: e.target.value as 'SERVICIO' | 'DESCUENTO',
                    }))
                  }
                  className="input-field"
                >
                  <option value="SERVICIO">Servicio gratis</option>
                  <option value="DESCUENTO">Descuento</option>
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

            {form.type === 'SERVICIO' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Servicio vinculado
                </label>
                <select
                  value={form.serviceId}
                  onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value }))}
                  className="input-field"
                >
                  <option value="">Cualquier servicio</option>
                  {services.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name} ({formatCurrency(svc.price)})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  El servicio que el cliente recibe gratis al canjear
                </p>
              </div>
            )}

            {form.type === 'DESCUENTO' && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modo</label>
                  <select
                    value={form.discountMode}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        discountMode: e.target.value as 'FLAT' | 'PERCENTAGE',
                      }))
                    }
                    className="input-field"
                  >
                    <option value="PERCENTAGE">Porcentaje (%)</option>
                    <option value="FLAT">Monto fijo</option>
                  </select>
                </div>
                {form.discountMode === 'FLAT' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                    <select value={(form as any).currency || 'USD'} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value } as any))} className="input-field">
                      <option value="USD">USD</option><option value="MXN">MXN</option><option value="DOP">DOP</option><option value="EUR">EUR</option><option value="COP">COP</option><option value="ARS">ARS</option><option value="CLP">CLP</option><option value="PEN">PEN</option><option value="BRL">BRL</option>
                    </select>
                  </div>
                )}
              </div>
            )}

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

            <div className="flex justify-between items-center gap-3 pt-2">
              <div>
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
                    {deleteMutation.isPending ? 'Desactivando...' : 'Desactivar cupón'}
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
                  {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </form>
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
              onClick={async () => {
                if (!giftRewardId || giftClientIds.length === 0) return;
                let sent = 0;
                for (const clientId of giftClientIds) {
                  try {
                    await api.post('/api/rewards/gift', { rewardId: giftRewardId, clientId });
                    sent++;
                  } catch (err) {
                    console.error('Error gifting to client:', clientId, err);
                  }
                }
                setGiftSuccess(`Cupón enviado a ${sent} cliente${sent !== 1 ? 's' : ''}`);
                setGiftClientIds([]);
              }}
              disabled={!giftRewardId || giftClientIds.length === 0 || giftMutation.isPending}
              className="btn-primary w-full"
            >
              {`Regalar cupón (${giftClientIds.length})`}
            </button>
          </div>
        </Modal>
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
  const active = reward.isActive;
  const stubColor = active ? '#008080' : '#9ca3af';

  const valueLabel = isDiscount
    ? (reward.discountMode === 'PERCENTAGE'
      ? `-${Number(reward.discountAmount ?? 0)}%`
      : `$${reward.discountAmount ?? 0}`)
    : 'GRATIS';
  const stubFontSize =
    valueLabel.length <= 4 ? '1.125rem' : valueLabel.length <= 6 ? '0.875rem' : '0.75rem';

  const expiry = formatExpiry(reward.validUntil);

  return (
    <div className="relative" style={{ opacity: active ? 1 : 0.75 }}>
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
            {isDiscount ? 'descuento' : 'servicio'}
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
                <button
                  onClick={onEdit}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex-shrink-0"
                  title="Editar"
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
                </button>
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
