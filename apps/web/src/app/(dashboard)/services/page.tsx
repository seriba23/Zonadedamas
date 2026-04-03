'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Modal } from '@/components/ui/modal';
import { formatCurrency } from '@/lib/utils';

interface Service {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  color?: string;
  isActive: boolean;
  category?: string;
  subcategory?: string;
  pointsReward?: number | null;
  redeemableWithPoints?: boolean;
  pointsRequired?: number | null;
  depositRequired?: boolean;
  depositPercent?: number | null;
}

interface ServiceForm {
  name: string;
  description: string;
  durationMinutes: number | string;
  price: number | string;
  catalogCategory: string;
  categories: string[];
  generatesPoints: boolean;
  pointsReward: number | string;
  redeemableWithPoints: boolean;
  pointsRequired: number | string;
}

const DEFAULT_CATEGORIES = [
  'Afeitado Clásico', 'Barba', 'Cejas y Pestañas', 'Coloración',
  'Corte', 'Depilación', 'Faciales', 'Manicure y Pedicure',
  'Maquillaje', 'Masajes', 'Medicina Estética', 'Otros',
  'Peinados y Styling', 'Piercing', 'Tatuajes', 'Tratamientos Capilares',
];

const defaultForm: ServiceForm = {
  name: '',
  description: '',
  durationMinutes: 60,
  price: 0,
  catalogCategory: '',
  categories: [],
  generatesPoints: false,
  pointsReward: '',
  redeemableWithPoints: false,
  pointsRequired: '',
};

export default function ServicesPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceForm>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories].sort((a, b) => a.localeCompare(b, 'es'));

  // Auto-open modal from URL ?new=true
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      openCreate();
    }
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<{ data: Service[] }>('/api/services'),
  });

  const { data: catalogData } = useQuery({
    queryKey: ['service-catalog'],
    queryFn: () => api.get<{ data: { name: string; category: string | null }[] }>('/api/marketplace/service-catalog'),
  });
  const catalogItems: { name: string; category: string | null }[] = (catalogData as any)?.data || [];

  const services = data?.data || [];

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => {
      if (editingService) {
        return api.put(`/api/services/${editingService.id}`, payload);
      }
      return api.post('/api/services', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      closeModal();
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al guardar el servicio');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/services/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  function openCreate() {
    setEditingService(null);
    setForm(defaultForm);
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEdit(service: Service) {
    setEditingService(service);
    const hasPoints = (service.pointsReward ?? 0) > 0;
    // Find catalog category for this service name
    const matchedCatalog = catalogItems.find((c) => c.name === service.name);
    setForm({
      name: service.name,
      description: service.description || '',
      durationMinutes: service.durationMinutes,
      price: service.price,
      catalogCategory: matchedCatalog?.category || '',
      categories: (service.subcategory || service.category || '').split(',').map(s => s.trim()).filter(Boolean),
      generatesPoints: hasPoints,
      pointsReward: service.pointsReward ?? '',
      redeemableWithPoints: service.redeemableWithPoints || false,
      pointsRequired: service.pointsRequired ?? '',
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingService(null);
    setForm(defaultForm);
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('El nombre es requerido');
      return;
    }
    const payload: Record<string, any> = {
      name: form.name,
      description: form.description,
      durationMinutes: Number(form.durationMinutes),
      price: Number(form.price),
      subcategory: form.categories.length > 0 ? form.categories.join(',') : null,
      redeemableWithPoints: form.redeemableWithPoints,
      pointsReward: form.generatesPoints && form.pointsReward !== '' ? Number(form.pointsReward) : null,
      pointsRequired: form.redeemableWithPoints && form.pointsRequired !== '' ? Number(form.pointsRequired) : null,
    };
    saveMutation.mutate(payload);
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Servicios" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            {services.length} servicio{services.length !== 1 ? 's' : ''}{' '}
            configurado{services.length !== 1 ? 's' : ''}
          </p>
          {hasPermission('services.create') && (
            <button onClick={openCreate} className="btn-primary">
              + Nuevo Servicio
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-200" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-gray-900 font-semibold mb-1">Crea tu primer servicio</p>
            <p className="text-sm text-gray-500 mb-5 max-w-xs">
              Configura los servicios que ofreces para que tus clientes puedan reservar
            </p>
            {hasPermission('services.create') && (
              <button
                onClick={openCreate}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: '#008080' }}
              >
                Crear servicio
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex-shrink-0"
                      style={{ backgroundColor: service.color || '#008080' }}
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">
                        {service.name}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {service.subcategory && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-600">
                            {service.subcategory}
                          </span>
                        )}
                        {!service.isActive && (
                          <span className="text-xs text-gray-400">Inactivo</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {hasPermission('services.update') && (
                    <button
                      onClick={() => openEdit(service)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
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

                {service.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                    {service.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-gray-600">
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
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-xs">{service.durationMinutes} min</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {service.depositRequired && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700">
                        Dep. {service.depositPercent}%
                      </span>
                    )}
                    {service.redeemableWithPoints && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700">
                        {service.pointsRequired} pts
                      </span>
                    )}
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(service.price)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <Modal
          title={editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
          onClose={closeModal}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria *
              </label>
              <select
                value={form.catalogCategory}
                onChange={(e) => setForm((f) => ({ ...f, catalogCategory: e.target.value, name: '' }))}
                className="input-field"
                required
              >
                <option value="">Seleccionar categoria...</option>
                {[...new Set(catalogItems.map((i) => i.category).filter(Boolean) as string[])]
                  .sort((a, b) => a.localeCompare(b, 'es'))
                  .map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Servicio *
              </label>
              <select
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="input-field"
                required
                disabled={!form.catalogCategory}
              >
                <option value="">{form.catalogCategory ? 'Seleccionar servicio...' : 'Primero selecciona una categoria'}</option>
                {catalogItems
                  .filter((i) => i.category === form.catalogCategory)
                  .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                  .map((item) => (
                    <option key={item.name} value={item.name}>{item.name}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="input-field resize-none"
                rows={2}
                placeholder="Descripción opcional..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duración (min) *
                </label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, durationMinutes: e.target.value }))
                  }
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                  className="input-field"
                  required
                />
              </div>
            </div>

            {/* Points section */}
            <div className="border-t border-gray-100 pt-4">
              <label className="flex items-center justify-between cursor-pointer mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Este servicio genera puntos</p>
                  <p className="text-xs text-[#008080]">Los puntos son un incentivo importante para la fidelidad de tus clientes</p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={form.generatesPoints}
                    onChange={(e) => setForm((f) => ({ ...f, generatesPoints: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-[#008080] peer-focus:ring-2 peer-focus:ring-teal-300 transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
                </div>
              </label>

              {form.generatesPoints && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Puntos que otorga *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.pointsReward}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, pointsReward: e.target.value }))
                    }
                    className="input-field"
                    placeholder="Ej: 100"
                    required={form.generatesPoints}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Puntos que el cliente acumula al completar este servicio
                  </p>
                </div>
              )}

              <label className="flex items-center justify-between cursor-pointer mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Canjeable con puntos</p>
                  <p className="text-xs text-gray-400">Los clientes pueden usar puntos para adquirir este servicio</p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={form.redeemableWithPoints}
                    onChange={(e) => setForm((f) => ({ ...f, redeemableWithPoints: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-[#008080] peer-focus:ring-2 peer-focus:ring-teal-300 transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
                </div>
              </label>

              {form.redeemableWithPoints && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Puntos requeridos *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.pointsRequired}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, pointsRequired: e.target.value }))
                    }
                    className="input-field"
                    placeholder="Ej: 500"
                    required={form.redeemableWithPoints}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Cantidad de puntos que un cliente necesita para canjear este servicio
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="btn-primary"
              >
                {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
