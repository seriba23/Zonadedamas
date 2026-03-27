'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Modal } from '@/components/ui/modal';
import { formatCurrency } from '@/lib/utils';

interface Promotion {
  id: string;
  name: string;
  description?: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'TWO_FOR_ONE';
  value: number;
  code?: string;
  startDate: string;
  endDate: string;
  maxUses?: number;
  usedCount: number;
  minAmount?: number;
  isActive: boolean;
  serviceIds?: string[];
  services?: { id: string; name: string }[];
}

interface PromotionForm {
  name: string;
  description: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'TWO_FOR_ONE';
  value: number | string;
  code: string;
  startDate: string;
  endDate: string;
  maxUses: number | string;
  minAmount: number | string;
  isActive: boolean;
  serviceIds: string[];
}

interface ServiceOption {
  id: string;
  name: string;
  price: number;
}

const defaultForm: PromotionForm = {
  name: '',
  description: '',
  type: 'PERCENTAGE',
  value: '',
  code: '',
  startDate: '',
  endDate: '',
  maxUses: '',
  minAmount: '',
  isActive: true,
  serviceIds: [],
};

const TYPE_LABELS: Record<string, string> = {
  PERCENTAGE: 'Porcentaje',
  FIXED_AMOUNT: 'Monto Fijo',
  TWO_FOR_ONE: '2x1',
};

const TYPE_COLORS: Record<string, string> = {
  PERCENTAGE: 'bg-blue-50 text-blue-700',
  FIXED_AMOUNT: 'bg-amber-50 text-amber-700',
  TWO_FOR_ONE: 'bg-purple-50 text-purple-700',
};

function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function isExpired(endDate: string): boolean {
  return new Date(endDate) < new Date();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PromotionsPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromotionForm>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');
  const [search, setSearch] = useState('');
  const perPage = 20;

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  queryParams.set('perPage', String(perPage));
  if (filterType) queryParams.set('type', filterType);
  if (filterActive) queryParams.set('isActive', filterActive);
  if (search.trim()) queryParams.set('search', search.trim());

  const { data, isLoading } = useQuery({
    queryKey: ['promotions', page, filterType, filterActive, search],
    queryFn: () =>
      api.get<{ data: Promotion[]; meta: any }>(`/api/promotions?${queryParams.toString()}`),
  });

  const promotions = data?.data || [];
  const meta = data?.meta;

  const { data: servicesData } = useQuery({
    queryKey: ['services-for-promotions'],
    queryFn: () => api.get<{ data: ServiceOption[] }>('/api/services'),
  });

  const services = servicesData?.data || [];

  const activeCount = promotions.filter((p) => p.isActive && !isExpired(p.endDate)).length;
  const totalUses = promotions.reduce((sum, p) => sum + p.usedCount, 0);

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => {
      if (editingPromotion) {
        return api.put(`/api/promotions/${editingPromotion.id}`, payload);
      }
      return api.post('/api/promotions', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      closeModal();
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al guardar la promocion');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/promotions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });

  function openCreate() {
    setEditingPromotion(null);
    setForm(defaultForm);
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEdit(promotion: Promotion) {
    setEditingPromotion(promotion);
    setForm({
      name: promotion.name,
      description: promotion.description || '',
      type: promotion.type,
      value: promotion.value,
      code: promotion.code || '',
      startDate: promotion.startDate ? promotion.startDate.split('T')[0] : '',
      endDate: promotion.endDate ? promotion.endDate.split('T')[0] : '',
      maxUses: promotion.maxUses ?? '',
      minAmount: promotion.minAmount ?? '',
      isActive: promotion.isActive,
      serviceIds: promotion.serviceIds || promotion.services?.map((s) => s.id) || [],
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingPromotion(null);
    setForm(defaultForm);
    setFormError(null);
  }

  function toggleServiceId(id: string) {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter((s) => s !== id)
        : [...f.serviceIds, id],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('El nombre es requerido');
      return;
    }
    if (!form.startDate || !form.endDate) {
      setFormError('Las fechas de inicio y fin son requeridas');
      return;
    }
    if (form.type !== 'TWO_FOR_ONE' && (!form.value || Number(form.value) <= 0)) {
      setFormError('El valor debe ser mayor a 0');
      return;
    }

    const payload: Record<string, any> = {
      name: form.name,
      description: form.description || undefined,
      type: form.type,
      value: form.type === 'TWO_FOR_ONE' ? 0 : Number(form.value),
      code: form.code || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      minAmount: form.minAmount ? Number(form.minAmount) : null,
      isActive: form.isActive,
      serviceIds: form.serviceIds.length > 0 ? form.serviceIds : undefined,
    };

    saveMutation.mutate(payload);
  }

  function formatValue(promotion: Promotion): string {
    if (promotion.type === 'PERCENTAGE') return `${promotion.value}%`;
    if (promotion.type === 'FIXED_AMOUNT') return formatCurrency(promotion.value);
    return '2x1';
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Promociones" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            Gestiona promociones y descuentos para tus clientes.
          </p>
          {hasPermission('promotions.read') && (
            <button onClick={openCreate} className="btn-primary">
              + Crear Promocion
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Promociones activas</p>
            <p className="text-2xl font-bold text-primary-700">{activeCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Total usos</p>
            <p className="text-2xl font-bold text-gray-900">{totalUses}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre..."
            className="input-field w-48"
          />
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setPage(1);
            }}
            className="input-field w-40"
          >
            <option value="">Todos los tipos</option>
            <option value="PERCENTAGE">Porcentaje</option>
            <option value="FIXED_AMOUNT">Monto Fijo</option>
            <option value="TWO_FOR_ONE">2x1</option>
          </select>
          <select
            value={filterActive}
            onChange={(e) => {
              setFilterActive(e.target.value);
              setPage(1);
            }}
            className="input-field w-36"
          >
            <option value="">Todos</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
          </select>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="animate-pulse p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/6" />
                  <div className="h-4 bg-gray-200 rounded w-1/6" />
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                </div>
              ))}
            </div>
          </div>
        ) : promotions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🏷️</div>
            <p className="text-gray-500 mb-4">No hay promociones configuradas</p>
            {hasPermission('promotions.read') && (
              <button onClick={openCreate} className="btn-primary">
                Crear primera promocion
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Valor</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Codigo</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Vigencia</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Usos</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {promotions.map((promo) => {
                      const expired = isExpired(promo.endDate);
                      return (
                        <tr
                          key={promo.id}
                          className={`hover:bg-gray-50 ${expired || !promo.isActive ? 'opacity-60' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900">{promo.name}</p>
                              {promo.description && (
                                <p className="text-xs text-gray-500 line-clamp-1">{promo.description}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TYPE_COLORS[promo.type]}`}>
                              {TYPE_LABELS[promo.type]}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {formatValue(promo)}
                          </td>
                          <td className="px-4 py-3">
                            {promo.code ? (
                              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                {promo.code}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {formatDate(promo.startDate)} - {formatDate(promo.endDate)}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {promo.usedCount}
                            {promo.maxUses ? ` / ${promo.maxUses}` : ''}
                          </td>
                          <td className="px-4 py-3">
                            {expired ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600">
                                Expirada
                              </span>
                            ) : promo.isActive ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700">
                                Activa
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                                Inactiva
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {hasPermission('promotions.read') && (
                                <button
                                  onClick={() => openEdit(promo)}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              )}
                              {hasPermission('promotions.read') && (
                                <button
                                  onClick={() => {
                                    if (confirm('¿Eliminar esta promocion?')) {
                                      deleteMutation.mutate(promo.id);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-gray-500">
                  Mostrando {(page - 1) * perPage + 1}-{Math.min(page * perPage, meta.total)} de{' '}
                  {meta.total}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`px-3 py-1.5 text-xs rounded-lg border ${
                        p === page
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                    disabled={page === meta.totalPages}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <Modal
          title={editingPromotion ? 'Editar Promocion' : 'Nueva Promocion'}
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
                placeholder="Ej: Descuento de Verano"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="input-field resize-none"
                rows={2}
                placeholder="Descripcion opcional..."
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
                      type: e.target.value as PromotionForm['type'],
                    }))
                  }
                  className="input-field"
                >
                  <option value="PERCENTAGE">Porcentaje (%)</option>
                  <option value="FIXED_AMOUNT">Monto Fijo ($)</option>
                  <option value="TWO_FOR_ONE">2x1</option>
                </select>
              </div>
              {form.type !== 'TWO_FOR_ONE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor {form.type === 'PERCENTAGE' ? '(%)' : '($)'} *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={form.type === 'PERCENTAGE' ? '1' : '0.01'}
                    max={form.type === 'PERCENTAGE' ? '100' : undefined}
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    className="input-field"
                    placeholder={form.type === 'PERCENTAGE' ? 'Ej: 20' : 'Ej: 5.00'}
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Codigo promocional</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="input-field flex-1 font-mono tracking-wider"
                  placeholder="Opcional"
                />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, code: generateCode() }))}
                  className="btn-secondary text-xs whitespace-nowrap"
                >
                  Generar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio *</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin *</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max. usos</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.maxUses}
                  onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                  className="input-field"
                  placeholder="Ilimitado"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto minimo</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minAmount}
                  onChange={(e) => setForm((f) => ({ ...f, minAmount: e.target.value }))}
                  className="input-field"
                  placeholder="Sin minimo"
                />
              </div>
            </div>

            {/* Service multi-select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Servicios aplicables
              </label>
              <p className="text-xs text-gray-400 mb-2">
                Selecciona los servicios donde aplica esta promocion. Si no seleccionas ninguno, aplica a todos.
              </p>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                {services.map((svc) => (
                  <label
                    key={svc.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.serviceIds.includes(svc.id)}
                      onChange={() => toggleServiceId(svc.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 flex-1">{svc.name}</span>
                    <span className="text-xs text-gray-400">{formatCurrency(svc.price)}</span>
                  </label>
                ))}
                {services.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">No hay servicios</p>
                )}
              </div>
              {form.serviceIds.length > 0 && (
                <p className="text-xs text-primary-600 mt-1">
                  {form.serviceIds.length} servicio{form.serviceIds.length !== 1 ? 's' : ''} seleccionado{form.serviceIds.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <label className="flex items-center justify-between cursor-pointer">
              <p className="text-sm font-medium text-gray-700">Activa</p>
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

            <div className="flex justify-end gap-3 pt-2">
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
    </div>
  );
}
