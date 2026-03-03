'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
}

interface ServiceForm {
  name: string;
  description: string;
  durationMinutes: number | string;
  price: number | string;
  color: string;
  category: string;
  subcategory: string;
  pointsReward: number | string;
  redeemableWithPoints: boolean;
  pointsRequired: number | string;
}

const SERVICE_CATEGORIES: Record<string, { label: string; subcategories: string[] }> = {
  SALON: {
    label: 'Salón',
    subcategories: [
      'Coloración',
      'Corte',
      'Tratamientos Capilares',
      'Alisados y Texturizados',
      'Peinados y Styling',
      'Extensiones',
      'Mechas y Balayage',
    ],
  },
  BARBERIA: {
    label: 'Barbería',
    subcategories: [
      'Cabello',
      'Barba',
      'Tratamientos',
      'Afeitado Clásico',
    ],
  },
  SPA: {
    label: 'SPA',
    subcategories: [
      'Masajes',
      'Faciales',
      'Tratamientos Corporales',
      'Exfoliación',
      'Aromaterapia',
    ],
  },
  CLINICA: {
    label: 'Clínica',
    subcategories: [
      'Dermatología',
      'Medicina Estética',
      'Depilación Láser',
      'Tratamientos Faciales',
      'Nutrición',
    ],
  },
  GENERAL: {
    label: 'General',
    subcategories: [
      'Manicure y Pedicure',
      'Maquillaje',
      'Cejas y Pestañas',
      'Depilación',
      'Otros',
    ],
  },
};

const defaultForm: ServiceForm = {
  name: '',
  description: '',
  durationMinutes: 60,
  price: 0,
  color: '#008080',
  category: '',
  subcategory: '',
  pointsReward: '',
  redeemableWithPoints: false,
  pointsRequired: '',
};

const SERVICE_COLORS = [
  '#00cccc', '#00b3b3', '#009999', '#008080',
  '#004d4d', '#003333', '#001919', '#000000', '#ffffff',
];

export default function ServicesPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceForm>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<{ data: Service[] }>('/api/services'),
  });

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
    setForm({
      name: service.name,
      description: service.description || '',
      durationMinutes: service.durationMinutes,
      price: service.price,
      color: service.color || '#008080',
      category: service.category || '',
      subcategory: service.subcategory || '',
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
      color: form.color,
      category: form.category || null,
      subcategory: form.subcategory || null,
      redeemableWithPoints: form.redeemableWithPoints,
      pointsReward: form.pointsReward !== '' ? Number(form.pointsReward) : null,
    };
    if (form.redeemableWithPoints && form.pointsRequired !== '') {
      payload.pointsRequired = Number(form.pointsRequired);
    } else {
      payload.pointsRequired = null;
    }
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
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No hay servicios configurados</p>
            {hasPermission('services.create') && (
              <button onClick={openCreate} className="btn-primary">
                Crear primer servicio
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
                Nombre *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="input-field"
                placeholder="Ej: Corte de cabello"
                required
              />
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
                  Categoría
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value, subcategory: '' }))
                  }
                  className="input-field"
                >
                  <option value="">Sin categoría</option>
                  {Object.entries(SERVICE_CATEGORIES).map(([key, cat]) => (
                    <option key={key} value={key}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subcategoría
                </label>
                <select
                  value={form.subcategory}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, subcategory: e.target.value }))
                  }
                  className="input-field"
                  disabled={!form.category}
                >
                  <option value="">Sin subcategoría</option>
                  {form.category &&
                    SERVICE_CATEGORIES[form.category]?.subcategories.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                </select>
              </div>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color
              </label>
              <div className="flex gap-2 flex-wrap">
                {SERVICE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color }))}
                    className={`w-8 h-8 rounded-full transition-transform ${form.color === color ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-110'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Points section */}
            <div className="border-t border-gray-100 pt-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Puntos que otorga
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.pointsReward}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, pointsReward: e.target.value }))
                  }
                  className="input-field"
                  placeholder={`Auto: ${Math.floor(Number(form.price) || 0)} pts (= precio)`}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Puntos que el cliente recibe al completar este servicio. Si se deja vacío, se usan los puntos equivalentes al precio.
                </p>
              </div>

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
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-300 transition-colors" />
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
