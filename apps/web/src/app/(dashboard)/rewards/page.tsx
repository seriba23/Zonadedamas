'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
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

export default function RewardsPage() {
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
  const [giftClientId, setGiftClientId] = useState('');
  const [giftSuccess, setGiftSuccess] = useState<string | null>(null);
  const [giftInForm, setGiftInForm] = useState(false);
  const [giftClientIds, setGiftClientIds] = useState<string[]>([]);

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
      setFormError(err.message || 'Error al guardar la recompensa');
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
    setGiftInForm(false);
    setGiftClientIds([]);
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
    if (!giftInForm && (!form.pointsRequired || Number(form.pointsRequired) < 1)) {
      setFormError('Los puntos requeridos deben ser al menos 1');
      return;
    }

    const payload: Record<string, any> = {
      name: form.name,
      description: form.description || undefined,
      type: form.type,
      pointsRequired: giftInForm ? 0 : Number(form.pointsRequired),
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

    // If gifting, mark as not publicly visible
    if (giftInForm && giftClientIds.length > 0) {
      payload.isActive = false;
    }

    saveMutation.mutate(payload, {
      onSuccess: async (res: any) => {
        // After saving, gift to selected clients
        if (giftInForm && giftClientIds.length > 0) {
          const rewardId = res?.data?.id || editingReward?.id;
          if (rewardId) {
            for (const clientId of giftClientIds) {
              try {
                await api.post('/api/rewards/gift', { rewardId, clientId });
              } catch (err) {
                console.error('Error gifting to client:', clientId, err);
              }
            }
          }
          setGiftInForm(false);
          setGiftClientIds([]);
        }
      },
    });
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Recompensas" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            Configura recompensas que tus clientes pueden canjear con sus puntos de fidelidad.
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
                + Nueva Recompensa
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div className="text-4xl mb-3">🎁</div>
            <p className="text-gray-500 mb-4">No hay recompensas configuradas</p>
            {hasPermission('rewards.create') && (
              <button onClick={openCreate} className="btn-primary">
                Crear primera recompensa
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow ${
                  reward.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 text-sm">{reward.name}</h3>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                          reward.type === 'SERVICIO'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {reward.type === 'SERVICIO' ? 'Servicio' : 'Descuento'}
                      </span>
                      {!reward.isActive && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-500">
                          Inactivo
                        </span>
                      )}
                    </div>
                    {reward.description && (
                      <p className="text-xs text-gray-500 line-clamp-2">{reward.description}</p>
                    )}
                  </div>
                  {hasPermission('rewards.update') && (
                    <button
                      onClick={() => openEdit(reward)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="space-y-2 text-xs text-gray-600">
                  {reward.type === 'SERVICIO' && reward.service && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">Servicio:</span>
                      <span className="font-medium">{reward.service.name}</span>
                    </div>
                  )}
                  {reward.type === 'DESCUENTO' && reward.discountAmount && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">Descuento:</span>
                      <span className="font-medium">
                        {reward.discountMode === 'PERCENTAGE'
                          ? `${reward.discountAmount}%`
                          : formatCurrency(reward.discountAmount)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">Canjes:</span>
                    <span className="text-xs font-medium text-gray-700">
                      {reward.timesRedeemed}
                      {reward.maxRedemptions ? ` / ${reward.maxRedemptions}` : ''}
                    </span>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-primary-50 text-primary-700">
                    {reward.pointsRequired} pts
                  </span>
                </div>

                {hasPermission('rewards.delete') && reward.isActive && (
                  <button
                    onClick={() => {
                      if (confirm('¿Desactivar esta recompensa?')) {
                        deleteMutation.mutate(reward.id);
                      }
                    }}
                    className="mt-2 w-full text-center text-xs text-red-500 hover:text-red-700 py-1"
                  >
                    Desactivar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <Modal
          title={editingReward ? 'Editar Recompensa' : 'Nueva Recompensa'}
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
              {!giftInForm && (
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
                    required={!giftInForm}
                  />
                </div>
              )}
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
              <div className="grid grid-cols-2 gap-4">
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
                    <option value="FLAT">Monto fijo ($)</option>
                  </select>
                </div>
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

            {/* Gift to specific clients */}
            <div className="border-t border-gray-200 pt-4">
              <label className="flex items-center justify-between cursor-pointer mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Regalar a clientes</p>
                  <p className="text-[11px] text-gray-400">Enviar directamente sin cobrar puntos. No se muestra públicamente.</p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={giftInForm}
                    onChange={(e) => { setGiftInForm(e.target.checked); if (!e.target.checked) setGiftClientIds([]); }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-300 transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
                </div>
              </label>

              {giftInForm && (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
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
                  {giftClientIds.length > 0 && (
                    <p className="text-xs text-[#008080] font-medium pt-1">{giftClientIds.length} cliente{giftClientIds.length !== 1 ? 's' : ''} seleccionado{giftClientIds.length !== 1 ? 's' : ''}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
                {saveMutation.isPending ? 'Guardando...' : (giftInForm && giftClientIds.length > 0 ? `Guardar y regalar (${giftClientIds.length})` : 'Guardar')}
              </button>
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

      {/* Gift coupon modal */}
      {giftModal && (
        <Modal title="Regalar cupón a cliente" onClose={() => setGiftModal(false)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recompensa</label>
              <select
                value={giftRewardId}
                onChange={(e) => setGiftRewardId(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Selecciona una recompensa</option>
                {rewards.filter((r) => r.isActive).map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.type === 'DESCUENTO' ? 'Descuento' : 'Servicio'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
              <select
                value={giftClientId}
                onChange={(e) => setGiftClientId(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Selecciona un cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
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
              onClick={() => giftMutation.mutate()}
              disabled={!giftRewardId || !giftClientId || giftMutation.isPending}
              className="btn-primary w-full"
            >
              {giftMutation.isPending ? 'Enviando...' : 'Regalar cupón'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
