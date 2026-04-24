'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Modal } from '@/components/ui/modal';
import { useCurrency } from '@/lib/hooks/use-currency';

interface ServiceInBundle {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

interface Bundle {
  id: string;
  name: string;
  description?: string;
  bundlePrice: number;
  isActive: boolean;
  flexibleOrder?: boolean;
  serviceIds?: string[];
  services: ServiceInBundle[];
  pointsReward?: number | null;
  redeemableWithPoints?: boolean;
  pointsRequired?: number | null;
}

interface BundleForm {
  name: string;
  description: string;
  bundlePrice: number | string;
  isActive: boolean;
  flexibleOrder: boolean;
  serviceIds: string[];
  generatesPoints: boolean;
  pointsReward: number | string;
  redeemableWithPoints: boolean;
  pointsRequired: number | string;
}

interface ServiceOption {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

const defaultForm: BundleForm = {
  name: '',
  description: '',
  bundlePrice: '',
  isActive: true,
  flexibleOrder: false,
  serviceIds: [],
  generatesPoints: false,
  pointsReward: '',
  redeemableWithPoints: false,
  pointsRequired: '',
};

export function BundlesContent({ embedded }: { embedded?: boolean } = {}) {
  const { format: formatCurrency } = useCurrency();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [form, setForm] = useState<BundleForm>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['service-bundles', page],
    queryFn: () =>
      api.get<{ data: Bundle[]; meta: any }>(`/api/service-bundles?page=${page}&perPage=${perPage}`),
  });

  const bundles = data?.data || [];
  const meta = data?.meta;

  const { data: servicesData } = useQuery({
    queryKey: ['services-for-bundles'],
    queryFn: () => api.get<{ data: ServiceOption[] }>('/api/services'),
  });

  const services = servicesData?.data || [];

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => {
      if (editingBundle) {
        return api.put(`/api/service-bundles/${editingBundle.id}`, payload);
      }
      return api.post('/api/service-bundles', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-bundles'] });
      closeModal();
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al guardar el paquete');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/service-bundles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-bundles'] });
    },
  });

  function openCreate() {
    setEditingBundle(null);
    setForm(defaultForm);
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEdit(bundle: Bundle) {
    setEditingBundle(bundle);
    setForm({
      name: bundle.name,
      description: bundle.description || '',
      bundlePrice: bundle.bundlePrice,
      isActive: bundle.isActive,
      flexibleOrder: bundle.flexibleOrder || false,
      serviceIds: bundle.services.map((s) => s.id),
      generatesPoints: !!bundle.pointsReward && bundle.pointsReward > 0,
      pointsReward: bundle.pointsReward || '',
      redeemableWithPoints: bundle.redeemableWithPoints || false,
      pointsRequired: bundle.pointsRequired || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingBundle(null);
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

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  function moveService(index: number, direction: 'up' | 'down') {
    setForm((f) => {
      const ids = [...f.serviceIds];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= ids.length) return f;
      [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];
      return { ...f, serviceIds: ids };
    });
  }

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  function handleDragStart(index: number) {
    dragItem.current = index;
    setDraggingIndex(index);
  }

  function handleDragEnter(index: number) {
    dragOverItem.current = index;
  }

  function handleDragEnd() {
    setDraggingIndex(null);
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    setForm((f) => {
      const ids = [...f.serviceIds];
      const draggedId = ids[dragItem.current!];
      ids.splice(dragItem.current!, 1);
      ids.splice(dragOverItem.current!, 0, draggedId);
      return { ...f, serviceIds: ids };
    });
    dragItem.current = null;
    dragOverItem.current = null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('El nombre es requerido');
      return;
    }
    if (!form.bundlePrice || Number(form.bundlePrice) <= 0) {
      setFormError('El precio del paquete debe ser mayor a 0');
      return;
    }
    if (form.serviceIds.length < 2) {
      setFormError('Selecciona al menos 2 servicios para el paquete');
      return;
    }

    const payload: Record<string, any> = {
      name: form.name,
      description: form.description || undefined,
      bundlePrice: Number(form.bundlePrice),
      isActive: form.isActive,
      flexibleOrder: form.flexibleOrder,
      serviceIds: form.serviceIds.filter((id): id is string => typeof id === 'string' && id.length > 0),
      pointsReward: form.generatesPoints && Number(form.pointsReward) > 0 ? Number(form.pointsReward) : null,
      redeemableWithPoints: form.redeemableWithPoints,
      pointsRequired: form.redeemableWithPoints && Number(form.pointsRequired) > 0 ? Number(form.pointsRequired) : null,
    };

    saveMutation.mutate(payload);
  }

  // Calculate totals for selected services in the form
  const selectedServices = services.filter((s) => form.serviceIds.includes(s.id));
  const totalOriginalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  const savingsPercent =
    totalOriginalPrice > 0 && Number(form.bundlePrice) > 0
      ? Math.round(((totalOriginalPrice - Number(form.bundlePrice)) / totalOriginalPrice) * 100)
      : 0;

  function getBundleOriginalPrice(bundle: Bundle): number {
    return bundle.services.reduce((sum, s) => sum + Number(s.price), 0);
  }

  function getBundleDuration(bundle: Bundle): number {
    return bundle.services.reduce((sum, s) => sum + s.durationMinutes, 0);
  }

  function getBundleSavings(bundle: Bundle): number {
    const original = getBundleOriginalPrice(bundle);
    if (original <= 0) return 0;
    return Math.round(((original - bundle.bundlePrice) / original) * 100);
  }

  return (
    <div className={embedded ? '' : 'flex flex-col h-full'}>
      {!embedded && <Header title="Paquetes de Servicios" />}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            Agrupa servicios en paquetes con precio especial para tus clientes.
          </p>
          {hasPermission('services.create') && (
            <button onClick={openCreate} className="btn-primary">
              + Crear Paquete
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/2 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : bundles.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500 mb-4">No hay paquetes configurados</p>
            {hasPermission('services.create') && (
              <button onClick={openCreate} className="btn-primary">
                Crear primer paquete
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bundles.map((bundle) => {
                const originalPrice = getBundleOriginalPrice(bundle);
                const duration = getBundleDuration(bundle);
                const savings = getBundleSavings(bundle);

                return (
                  <div
                    key={bundle.id}
                    className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow ${
                      bundle.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">{bundle.name}</h3>
                          {savings > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-50 text-green-700 flex-shrink-0">
                              -{savings}%
                            </span>
                          )}
                          {!bundle.isActive && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                              Inactivo
                            </span>
                          )}
                        </div>
                        {bundle.description && (
                          <p className="text-xs text-gray-500 line-clamp-2">{bundle.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {hasPermission('services.update') && (
                          <button
                            onClick={() => openEdit(bundle)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {hasPermission('services.delete') && (
                          <button
                            onClick={() => {
                              if (confirm('¿Eliminar este paquete?')) {
                                deleteMutation.mutate(bundle.id);
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
                    </div>

                    {/* Services list */}
                    <div className="space-y-1 mb-3">
                      {bundle.services.map((svc, idx) => (
                        <div key={svc.id} className="flex items-center gap-2 text-xs">
                          {!bundle.flexibleOrder ? (
                            <span className="w-4 h-4 rounded-full bg-[#008080] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                              {idx + 1}
                            </span>
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#008080] flex-shrink-0" />
                          )}
                          <span className="text-gray-600 flex-1 truncate">{svc.name}</span>
                          <span className="text-gray-400">{formatCurrency(svc.price)}</span>
                        </div>
                      ))}
                    </div>
                    {bundle.flexibleOrder && (
                      <p className="text-[10px] text-gray-400 mb-2 italic">Orden flexible</p>
                    )}

                    {/* Points badges */}
                    {((bundle as any).pointsReward > 0 || (bundle as any).redeemableWithPoints) && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {(bundle as any).pointsReward > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#e0f2f1] text-[#008080]">
                            +{(bundle as any).pointsReward} pts
                          </span>
                        )}
                        {(bundle as any).redeemableWithPoints && (bundle as any).pointsRequired > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#e0f2f1] text-[#008080]">
                            Canjeable: {(bundle as any).pointsRequired} pts
                          </span>
                        )}
                      </div>
                    )}

                    {/* Price and duration */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs">{duration} min</span>
                      </div>
                      <div className="text-right">
                        {originalPrice > bundle.bundlePrice && (
                          <span className="text-xs text-gray-400 line-through mr-2">
                            {formatCurrency(originalPrice)}
                          </span>
                        )}
                        <span className="text-sm font-semibold text-primary-700">
                          {formatCurrency(bundle.bundlePrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
          title={editingBundle ? 'Editar Paquete' : 'Nuevo Paquete'}
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
                placeholder="Ej: Paquete Novia"
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

            {/* Service multi-select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Servicios incluidos *
              </label>
              <p className="text-xs text-gray-400 mb-2">
                Selecciona al menos 2 servicios para el paquete.
              </p>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                {services.map((svc) => (
                  <label
                    key={svc.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.serviceIds.includes(svc.id)}
                      onChange={() => toggleServiceId(svc.id)}
                      className="rounded border-gray-300 text-[#008080] focus:ring-[#008080]"
                    />
                    <span className="text-sm text-gray-700 flex-1">{svc.name}</span>
                    <span className="text-xs text-gray-400">
                      {formatCurrency(svc.price)} / {svc.durationMinutes} min
                    </span>
                  </label>
                ))}
                {services.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">No hay servicios</p>
                )}
              </div>
              {form.serviceIds.length > 0 && (
                <p className="text-xs text-[#008080] mt-1">
                  {form.serviceIds.length} servicio{form.serviceIds.length !== 1 ? 's' : ''} seleccionado{form.serviceIds.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Service order */}
            {form.serviceIds.length >= 2 && (
              <div>
                <label className="flex items-center justify-between cursor-pointer mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Los servicios no tienen un orden necesario</p>
                    <p className="text-xs text-gray-400">Si se activa, el sistema puede reordenar para encontrar disponibilidad</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={form.flexibleOrder}
                      onChange={(e) => setForm((f) => ({ ...f, flexibleOrder: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-[#008080] peer-focus:ring-2 peer-focus:ring-teal-300 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
                  </div>
                </label>

                {!form.flexibleOrder && (
                  <>
                    <p className="text-xs font-medium text-gray-500 mb-2">Orden de atención</p>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      {form.serviceIds.map((id, index) => {
                        const svc = services.find((s) => s.id === id);
                        if (!svc) return null;
                        return (
                          <div
                            key={id}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragEnter={() => handleDragEnter(index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            className={`flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 last:border-b-0 bg-white hover:bg-gray-50 cursor-grab active:cursor-grabbing select-none ${draggingIndex === index ? 'opacity-50' : ''}`}
                          >
                            {/* Drag handle */}
                            <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                              <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                              <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                            </svg>
                            <span className="w-5 h-5 rounded-full bg-[#008080] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                              {index + 1}
                            </span>
                            <span className="text-sm text-gray-700 flex-1">{svc.name}</span>
                            <span className="text-xs text-gray-400 flex-shrink-0">{svc.durationMinutes} min</span>
                            <div className="flex flex-col flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => moveService(index, 'up')}
                                disabled={index === 0}
                                className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => moveService(index, 'down')}
                                disabled={index === form.serviceIds.length - 1}
                                className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      Arrastra o usa las flechas para definir el orden de atención.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio del paquete *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.bundlePrice}
                onChange={(e) => setForm((f) => ({ ...f, bundlePrice: e.target.value }))}
                className="input-field"
                placeholder="Ej: 50.00"
                required
              />
            </div>

            {/* Calculated summary */}
            {selectedServices.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Precio original (suma):</span>
                  <span className="font-medium text-gray-700">{formatCurrency(totalOriginalPrice)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Duracion total:</span>
                  <span className="font-medium text-gray-700">{totalDuration} min</span>
                </div>
                {Number(form.bundlePrice) > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Ahorro:</span>
                    <span className={`font-medium ${savingsPercent > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {savingsPercent > 0 ? `-${savingsPercent}%` : savingsPercent === 0 ? '0%' : `+${Math.abs(savingsPercent)}%`}
                      {' '}
                      ({formatCurrency(totalOriginalPrice - Number(form.bundlePrice))})
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Points system */}
            <div className="border border-gray-200 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sistema de puntos</p>
              <p className="text-xs text-[#008080]">Los puntos son un incentivo importante para la fidelidad de tus clientes</p>

              {/* Generates points */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-700">Este paquete genera puntos</p>
                  <p className="text-xs text-gray-400">El cliente recibe puntos al adquirir este paquete</p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={form.generatesPoints}
                    onChange={(e) => setForm((f) => ({ ...f, generatesPoints: e.target.checked, ...(!e.target.checked && { pointsReward: '' }) }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-300 transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
                </div>
              </label>
              {form.generatesPoints && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Puntos que otorga</label>
                  <input
                    type="number"
                    min="1"
                    value={form.pointsReward}
                    onChange={(e) => setForm((f) => ({ ...f, pointsReward: e.target.value }))}
                    className="input-field"
                    placeholder="Ej: 50"
                  />
                </div>
              )}

              {/* Redeemable with points */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-700">Canjeable con puntos</p>
                  <p className="text-xs text-gray-400">Los clientes pueden usar puntos para adquirir este paquete</p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={form.redeemableWithPoints}
                    onChange={(e) => setForm((f) => ({ ...f, redeemableWithPoints: e.target.checked, ...(!e.target.checked && { pointsRequired: '' }) }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-300 transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
                </div>
              </label>
              {form.redeemableWithPoints && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Puntos necesarios para canjear</label>
                  <input
                    type="number"
                    min="1"
                    value={form.pointsRequired}
                    onChange={(e) => setForm((f) => ({ ...f, pointsRequired: e.target.value }))}
                    className="input-field"
                    placeholder="Ej: 100"
                  />
                </div>
              )}
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

export default function BundlesPage() {
  return <BundlesContent />;
}
