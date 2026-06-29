'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Modal } from '@/components/ui/modal';
import { formatCurrency as rawFormatCurrency } from '@/lib/utils';
import { useCurrency } from '@/lib/hooks/use-currency';
import { useRegisterTopbarAction } from '@/lib/hooks/use-topbar-action';

interface Service {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  currency?: string;
  color?: string;
  isActive: boolean;
  category?: string;
  subcategory?: string;
  pointsReward?: number | null;
  redeemableWithPoints?: boolean;
  pointsRequired?: number | null;
  depositRequired?: boolean;
  depositPercent?: number | null;
  _count?: { employeeServices: number };
}

interface ServiceForm {
  name: string;
  description: string;
  durationMinutes: number | string;
  price: number | string;
  catalogCategory: string;
  currency: string;
  categories: string[];
  generatesPoints: boolean;
  pointsReward: number | string;
  redeemableWithPoints: boolean;
  pointsRequired: number | string;
}

// No defaults — categories come from service catalog (professions)
const DEFAULT_CATEGORIES: string[] = [];

const defaultForm: ServiceForm = {
  name: '',
  description: '',
  durationMinutes: 60,
  price: 0,
  catalogCategory: '',
  currency: 'MXN',
  categories: [],
  generatesPoints: false,
  pointsReward: '',
  redeemableWithPoints: false,
  pointsRequired: '',
};

export function ServicesContent() {
  const { format: formatCurrency } = useCurrency();
  const { hasPermission } = usePermissions();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceForm>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [expandAfterSwitch, setExpandAfterSwitch] = useState<string | null>(null);
  // Modal de "asignar empleados al servicio". Guardamos el servicio sobre
  // el que se trabaja; los empleados/comisiones se manejan dentro del
  // componente del modal.
  const [assignTarget, setAssignTarget] = useState<Service | null>(null);
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories].sort((a, b) => a.localeCompare(b, 'es'));

  const [autoPopulated, setAutoPopulated] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<{ data: Service[] }>('/api/services?perPage=100'),
  });

  // Auto-populate from catalog if no services exist
  useEffect(() => {
    const services = data?.data || [];
    if (!isLoading && services.length === 0 && !autoPopulated) {
      setAutoPopulated(true);
      api.post('/api/services/auto-populate', {}).then(() => {
        queryClient.invalidateQueries({ queryKey: ['services'] });
      }).catch(() => {});
    }
  }, [data, isLoading, autoPopulated]);

  // Auto-open modal from URL ?new=true
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      openCreate();
    }
  }, []);

  const { data: catalogData } = useQuery({
    queryKey: ['service-catalog'],
    queryFn: () => api.get<{ data: { name: string; category: string | null }[] }>('/api/marketplace/service-catalog'),
  });
  const catalogItems: { name: string; category: string | null }[] = (catalogData as any)?.data || [];

  // Profesiones reales (tabla Profession, gestionada desde SuperAdmin
  // en /platform/professions). Esta es la fuente de verdad del dropdown
  // de profesion al crear/editar un servicio.
  const { data: professionsData } = useQuery({
    queryKey: ['marketplace-professions'],
    queryFn: () => api.get<{ data: string[] }>('/api/marketplace/professions'),
  });
  const professions: string[] = (professionsData as any)?.data || [];

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
      // If opened from invite-codes, close this tab
      const returnTo = searchParams.get('returnTo');
      if (returnTo === 'invite-codes') {
        window.close();
      }
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

  // Registrar el boton "Nuevo" en el topbar global (a la izquierda del bell).
  useRegisterTopbarAction(
    hasPermission('services.create') ? (
      <button
        onClick={openCreate}
        className="px-3 md:px-3.5 py-1.5 text-xs md:text-sm font-semibold rounded-lg bg-[#008080] text-white hover:bg-[#006666] transition-colors whitespace-nowrap"
      >
        Nuevo
      </button>
    ) : null,
    [hasPermission('services.create')],
  );

  function openEdit(service: Service) {
    setEditingService(service);
    const hasPoints = (service.pointsReward ?? 0) > 0;
    // Find catalog category: try by name match, then fall back to service's subcategory/category
    const matchedCatalog = catalogItems.find((c) => c.name === service.name);
    const profession = matchedCatalog?.category || service.subcategory || service.category || '';
    setForm({
      name: service.name,
      description: service.description || '',
      durationMinutes: service.durationMinutes,
      price: service.price,
      catalogCategory: profession,
      currency: service.currency || 'MXN',
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
      currency: form.currency,
      subcategory: form.categories.length > 0 ? form.categories.join(',') : (form.catalogCategory || null),
      redeemableWithPoints: form.redeemableWithPoints,
      pointsReward: form.generatesPoints && form.pointsReward !== '' ? Number(form.pointsReward) : null,
      pointsRequired: form.redeemableWithPoints && form.pointsRequired !== '' ? Number(form.pointsRequired) : null,
    };
    saveMutation.mutate(payload);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <p className="text-sm text-gray-500 mb-3 md:mb-6">
          {services.length} servicio{services.length !== 1 ? 's' : ''}{' '}
          configurado{services.length !== 1 ? 's' : ''}
        </p>

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
          <div className="space-y-6">
            {(() => {
              // Servicios sin empleados → bloque dedicado arriba (fuera
              // de categorias) para que el admin los detecte rapido y
              // les asigne personal. El resto se agrupa como siempre.
              const needsAssignment = services.filter((s) => (s._count?.employeeServices ?? 0) === 0);
              const assigned = services.filter((s) => (s._count?.employeeServices ?? 0) > 0);

              const grouped: Record<string, Service[]> = {};
              const uncategorized: Service[] = [];
              assigned.forEach((s) => {
                const cat = s.subcategory || s.category;
                if (cat) {
                  if (!grouped[cat]) grouped[cat] = [];
                  grouped[cat].push(s);
                } else {
                  uncategorized.push(s);
                }
              });
              const sortedCats = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'es'));
              if (uncategorized.length > 0) sortedCats.push('Otros');

              const sections: React.ReactNode[] = [];

              if (needsAssignment.length > 0) {
                sections.push(
                  <div key="__needs-assignment">
                    <div className="mb-3">
                      <h3 className="text-sm font-bold text-gray-900">
                        Sin empleados asignados
                      </h3>
                      <p className="text-[11px] text-gray-400">
                        {needsAssignment.length} servicio{needsAssignment.length !== 1 ? 's' : ''} requieren accion
                      </p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-50">
                      {needsAssignment.map((service) => (
                        <div key={service.id} className="flex flex-col">
                          <div
                            className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => openEdit(service)}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{service.name}</p>
                              {service.description && (
                                <p className="text-xs text-gray-400 truncate">{service.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-gray-400 flex-shrink-0">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-xs">{service.durationMinutes}min</span>
                            </div>
                            <span className={`text-sm font-semibold flex-shrink-0 ${Number(service.price) === 0 ? 'text-teal-600' : 'text-gray-900'}`}>
                              {Number(service.price) === 0 ? 'Sin precio' : formatCurrency(service.price, service.currency)}
                            </span>
                            {hasPermission('services.delete') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar "${service.name}"?`)) deleteMutation.mutate(service.id); }}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 flex-shrink-0"
                                title="Eliminar"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                          {/* Bloque naranja: aviso + CTA. Texto y boton
                              comparten el mismo fondo para que sea claro
                              que pertenecen a la misma alerta. */}
                          <div
                            className="mx-4 mb-3 rounded-xl p-3 space-y-2"
                            style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}
                          >
                            <p className="text-xs leading-relaxed" style={{ color: '#9a3412' }}>
                              Este servicio aun no cuenta con empleados asignados. Es necesario asignar un empleado para poder mostrar este servicio en tu perfil.
                            </p>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setAssignTarget(service); }}
                              className="w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-colors"
                              style={{ backgroundColor: '#f97316' }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ea580c')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f97316')}
                            >
                              Asignar empleados
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>,
                );
              }

              sortedCats.forEach((cat) => {
                const catServices = cat === 'Otros' ? uncategorized : grouped[cat];
                sections.push(
                  <div key={cat}>
                    {/* Category header */}
                    <div className="mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{cat}</h3>
                        <p className="text-[11px] text-gray-400">{catServices.length} servicio{catServices.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    {/* Services list */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-50">
                      {catServices.map((service) => (
                        <div key={service.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openEdit(service)}>
                          {/* Name + description */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{service.name}</p>
                            {service.description && (
                              <p className="text-xs text-gray-400 truncate">{service.description}</p>
                            )}
                          </div>

                          {/* Duration */}
                          <div className="flex items-center gap-1 text-gray-400 flex-shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs">{service.durationMinutes}min</span>
                          </div>

                          {/* Price */}
                          <span className={`text-sm font-semibold flex-shrink-0 ${Number(service.price) === 0 ? 'text-teal-600' : 'text-gray-900'}`}>
                            {Number(service.price) === 0 ? 'Sin precio' : formatCurrency(service.price, service.currency)}
                          </span>

                          {/* Delete */}
                          {hasPermission('services.delete') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar "${service.name}"?`)) deleteMutation.mutate(service.id); }}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 flex-shrink-0"
                              title="Eliminar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>,
                );
              });

              return sections;
            })()}
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
                Profesión *
              </label>
              <select
                value={form.catalogCategory}
                onChange={(e) => setForm((f) => ({ ...f, catalogCategory: e.target.value, name: '' }))}
                className="input-field"
                required
              >
                <option value="">Seleccionar profesión...</option>
                {(() => {
                  // Fuente principal: tabla Profession (SuperAdmin).
                  // Union con categorias del catalogo por si hay alguna
                  // historica no migrada. Dedup + sort alfabetico.
                  const fromCatalog = catalogItems.map((i) => i.category).filter(Boolean) as string[];
                  return [...new Set([...professions, ...fromCatalog])]
                    .sort((a, b) => a.localeCompare(b, 'es'))
                    .map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ));
                })()}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Servicio *
                </label>
                {/* Botón "+" para crear servicio personalizado — visible
                    junto al label para que sea descubrible sin tener que
                    abrir el dropdown. */}
                {form.catalogCategory && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, name: '__custom__' }))}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-teal-200 bg-teal-50 text-[#008080] hover:bg-teal-100 transition-colors"
                    title="Crear servicio personalizado"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Crear personalizado
                  </button>
                )}
              </div>
              {(() => {
                // Si la profesion seleccionada tiene plantillas en el catalogo,
                // mostramos dropdown con plantillas. Si el usuario quiere
                // crear uno propio, lo activa con el botón "+ Crear
                // personalizado" del header del label.
                // Si no tiene plantillas (caso Lashista recien creada), input
                // de texto libre directamente.
                const templates = catalogItems
                  .filter((i) => i.category === form.catalogCategory)
                  .sort((a, b) => a.name.localeCompare(b.name, 'es'));
                const CUSTOM_FLAG = '__custom__';
                const hasTemplates = templates.length > 0;
                const isCustom = form.name === CUSTOM_FLAG || (!!form.name && hasTemplates && !templates.some((t) => t.name === form.name));

                if (!form.catalogCategory) {
                  return (
                    <select className="input-field" disabled>
                      <option>Primero selecciona una profesión</option>
                    </select>
                  );
                }
                if (!hasTemplates) {
                  // Sin plantillas: input de texto libre.
                  return (
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ej: Extensiones de pestañas"
                      className="input-field"
                      required
                    />
                  );
                }
                // Con plantillas: si está en modo personalizado, mostramos
                // card destacada con input libre. Si no, dropdown limpio
                // con el catálogo.
                if (isCustom) {
                  return (
                    <div className="rounded-xl border-2 p-3" style={{ borderColor: '#008080', backgroundColor: '#e0f2f1' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold" style={{ color: '#008080' }}>Servicio personalizado</p>
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, name: '' }))}
                          className="text-[11px] font-medium text-gray-500 hover:text-gray-700"
                        >
                          Cancelar
                        </button>
                      </div>
                      <input
                        type="text"
                        value={form.name === CUSTOM_FLAG ? '' : form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Ej: Tratamiento de keratina premium"
                        className="input-field"
                        required
                        autoFocus
                      />
                    </div>
                  );
                }
                return (
                  <select
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="input-field"
                    required
                  >
                    <option value="">Seleccionar servicio del catálogo...</option>
                    {templates.map((item) => (
                      <option key={item.name} value={item.name}>{item.name}</option>
                    ))}
                  </select>
                );
              })()}
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
                <div className="flex">
                  <span className="inline-flex items-center border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 px-3 text-sm font-medium text-gray-600">
                    MXN
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                    className="input-field rounded-l-none flex-1"
                    required
                  />
                </div>
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

            {/* Ver comisiones: solo al editar un servicio existente. Lleva a
                Personal → Comisiones → Por servicio con este servicio abierto. */}
            {editingService && (
              <button
                type="button"
                onClick={() => router.push(`/staff?tab=comisiones&commView=service&serviceId=${editingService.id}`)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#008080] text-[#008080] text-sm font-semibold hover:bg-teal-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Ver comisiones
              </button>
            )}

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

      {assignTarget && (
        <AssignEmployeesModal
          key={assignTarget.id}
          service={assignTarget}
          onClose={() => setAssignTarget(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['services'] });
            setAssignTarget(null);
          }}
        />
      )}
    </div>
  );
}

/* ─── Assign Employees Modal — checkbox + comision por empleado ─── */
function AssignEmployeesModal({
  service,
  onClose,
  onSaved,
}: {
  service: Service;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { format: formatCurrency } = useCurrency();
  const { data: employeesData } = useQuery({
    queryKey: ['assign-employees', 'employees'],
    queryFn: () => api.get<{ data: any[] }>('/api/employees?perPage=100'),
  });
  const employees = (employeesData?.data || []).filter((e: any) => e.isActive);

  // Map de empleado -> { selected, commission, commissionType }
  type CommType = 'AMOUNT' | 'PERCENT';
  type Cfg = { selected: boolean; commission: string; commissionType: CommType };
  const [cfg, setCfg] = useState<Map<string, Cfg>>(new Map());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const m = new Map<string, Cfg>();
    for (const emp of employees) {
      const es = (emp.employeeServices || []).find(
        (x: any) => (x.service?.id || x.serviceId) === service.id,
      );
      m.set(emp.id, {
        selected: !!es,
        commission: es?.commission != null ? String(Number(es.commission)) : '',
        commissionType: (es?.commissionType as CommType) === 'PERCENT' ? 'PERCENT' : 'AMOUNT',
      });
    }
    setCfg(m);
  }, [employeesData, service.id]);

  function toggle(empId: string) {
    setCfg((prev) => {
      const n = new Map(prev);
      const c = n.get(empId) || { selected: false, commission: '', commissionType: 'AMOUNT' as CommType };
      n.set(empId, { ...c, selected: !c.selected });
      return n;
    });
  }

  function updateComm(empId: string, value: string) {
    setCfg((prev) => {
      const n = new Map(prev);
      const c = n.get(empId) || { selected: true, commission: '', commissionType: 'AMOUNT' as CommType };
      n.set(empId, { ...c, commission: value });
      return n;
    });
  }

  function setCommType(empId: string, type: CommType) {
    setCfg((prev) => {
      const n = new Map(prev);
      const c = n.get(empId) || { selected: true, commission: '', commissionType: 'AMOUNT' as CommType };
      n.set(empId, { ...c, commissionType: type });
      return n;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = Array.from(cfg.entries())
        .filter(([, c]) => c.selected)
        .map(([employeeId, c]) => ({
          employeeId,
          commission: c.commission === '' ? null : parseFloat(c.commission),
          commissionType: c.commissionType,
        }));
      await api.put(`/api/services/${service.id}/employees`, { employees: payload });
      onSaved();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const q = search.trim().toLowerCase();
  const visibleEmps = q
    ? employees.filter((e: any) =>
        `${e.firstName} ${e.lastName} ${e.jobTitle || ''}`.toLowerCase().includes(q),
      )
    : employees;
  const selectedCount = Array.from(cfg.values()).filter((c) => c.selected).length;

  return (
    <Modal
      title={`Asignar empleados — ${service.name}`}
      onClose={onClose}
      size="md"
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Marca los empleados que ofrecerán este servicio y define el % de comisión que recibirán por cada cita.
        </p>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empleado o puesto..."
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
        />

        <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
          {visibleEmps.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-6">
              Sin coincidencias
            </p>
          ) : (
            visibleEmps.map((emp: any) => {
              const c = cfg.get(emp.id) || { selected: false, commission: '', commissionType: 'AMOUNT' as CommType };
              const price = Number(service.price);
              const commNum = c.commission === '' ? null : parseFloat(c.commission);
              const profit =
                commNum == null
                  ? price
                  : c.commissionType === 'PERCENT'
                    ? price - (price * commNum) / 100
                    : price - commNum;
              return (
                <div
                  key={emp.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    c.selected
                      ? 'bg-teal-50 border-teal-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggle(emp.id)}
                      aria-label={c.selected ? 'Desmarcar' : 'Marcar'}
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        c.selected
                          ? 'bg-[#008080] border-[#008080]'
                          : 'bg-white border-gray-300'
                      }`}
                    >
                      {c.selected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggle(emp.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {emp.firstName} {emp.lastName}
                      </p>
                      {emp.jobTitle && (
                        <p className="text-xs text-gray-500 truncate">{emp.jobTitle}</p>
                      )}
                    </button>
                  </div>

                  {c.selected && (
                    <div className="mt-3 pl-8 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Comisión</label>
                        <div className="flex items-center gap-1.5">
                          <div className="inline-flex bg-gray-100 border border-gray-200 rounded-lg p-0.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setCommType(emp.id, 'AMOUNT')}
                              className={`px-2.5 py-1.5 text-sm font-bold rounded-md transition-colors ${
                                c.commissionType === 'AMOUNT'
                                  ? 'bg-[#008080] text-white'
                                  : 'text-gray-500'
                              }`}
                              title="Monto fijo"
                            >
                              $
                            </button>
                            <button
                              type="button"
                              onClick={() => setCommType(emp.id, 'PERCENT')}
                              className={`px-2.5 py-1.5 text-sm font-bold rounded-md transition-colors ${
                                c.commissionType === 'PERCENT'
                                  ? 'bg-[#008080] text-white'
                                  : 'text-gray-500'
                              }`}
                              title="Porcentaje del precio"
                            >
                              %
                            </button>
                          </div>
                          <input
                            type="number"
                            min="0"
                            max={c.commissionType === 'PERCENT' ? 100 : undefined}
                            step="0.01"
                            value={c.commission}
                            onChange={(e) => updateComm(emp.id, e.target.value)}
                            placeholder="0"
                            className="w-full text-right text-sm border border-gray-200 rounded-lg px-2 py-1.5 tabular-nums focus:outline-none focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Ganancia neta</label>
                        <p className={`text-sm font-semibold tabular-nums py-1.5 ${
                          commNum != null
                            ? profit >= 0 ? 'text-green-600' : 'text-red-600'
                            : 'text-gray-400'
                        }`}>
                          {commNum != null ? formatCurrency(profit, service.currency) : '—'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            {selectedCount} empleado{selectedCount === 1 ? '' : 's'} asignado{selectedCount === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#008080] text-white hover:bg-[#006666] disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Service Commissions View — per service, expand to see employees ─── */
function ServiceCommissionsView({ services, allEmployees, autoExpandServiceId, onAutoExpanded }: { services: Service[]; allEmployees: any[]; autoExpandServiceId?: string | null; onAutoExpanded?: () => void }) {
  const { format: formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [expandedSvcs, setExpandedSvcs] = useState<Set<string>>(new Set());
  const [editingComm, setEditingComm] = useState<Map<string, Map<string, string>>>(new Map()); // svcId -> empId -> commission
  const [savingSvcId, setSavingSvcId] = useState<string | null>(null);
  const [savedSvcId, setSavedSvcId] = useState<string | null>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const svcRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (autoExpandServiceId) {
      setExpandedSvcs((prev) => new Set(prev).add(autoExpandServiceId));
      setTimeout(() => {
        svcRefs.current.get(autoExpandServiceId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        onAutoExpanded?.();
      }, 100);
    }
  }, [autoExpandServiceId]);

  function getEmployeesForService(svcId: string) {
    return allEmployees.map((emp: any) => {
      const es = (emp.employeeServices || []).find((e: any) => (e.service?.id || e.serviceId) === svcId);
      return { emp, assigned: !!es, commission: es?.commission != null ? Number(es.commission) : null };
    });
  }

  function getEditedComm(svcId: string, empId: string, original: number | null) {
    return editingComm.get(svcId)?.get(empId) ?? (original != null ? String(original) : '');
  }

  function setComm(svcId: string, empId: string, value: string) {
    setEditingComm((prev) => {
      const next = new Map(prev);
      const svcMap = new Map(next.get(svcId) || []);
      svcMap.set(empId, value);
      next.set(svcId, svcMap);
      return next;
    });
  }

  function toggleEmpForService(svcId: string, empId: string, empServices: any[]) {
    // Toggle by saving immediately via the employee services endpoint
    setEditingComm((prev) => {
      const next = new Map(prev);
      const svcMap = new Map(next.get(svcId) || []);
      svcMap.set(empId, svcMap.has(empId) ? '__TOGGLE__' : '0');
      next.set(svcId, svcMap);
      return next;
    });
  }

  function hasSvcChanges(svcId: string) {
    return (editingComm.get(svcId)?.size || 0) > 0;
  }

  async function saveSvcChanges(svcId: string) {
    setSavingSvcId(svcId);
    const svcEdits = editingComm.get(svcId);
    if (!svcEdits) { setSavingSvcId(null); return; }

    for (const [empId, val] of svcEdits) {
      try {
        const res = await api.get<{ data: any[] }>(`/api/employees/${empId}/services`);
        const current = res.data || [];
        const hasService = current.some((es: any) => es.serviceId === svcId);

        let finalServices;
        if (val === '__TOGGLE__') {
          // Remove
          finalServices = current.filter((es: any) => es.serviceId !== svcId).map((es: any) => ({
            serviceId: es.serviceId,
            commission: es.commission != null ? Number(es.commission) : null,
          }));
        } else if (!hasService) {
          // Add
          finalServices = [
            ...current.map((es: any) => ({ serviceId: es.serviceId, commission: es.commission != null ? Number(es.commission) : null })),
            { serviceId: svcId, commission: val ? Number(val) : null },
          ];
        } else {
          // Update commission
          finalServices = current.map((es: any) => ({
            serviceId: es.serviceId,
            commission: es.serviceId === svcId ? (val ? Number(val) : null) : (es.commission != null ? Number(es.commission) : null),
          }));
        }
        await api.put(`/api/employees/${empId}/services`, { services: finalServices });
      } catch (err) {
        console.error('Error saving:', empId, err);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['employees-for-commissions'] });
    setEditingComm((prev) => { const n = new Map(prev); n.delete(svcId); return n; });
    setSavingSvcId(null);
    setSavedSvcId(svcId);
    setTimeout(() => setSavedSvcId(null), 2000);
  }

  // Group by category
  const grouped: Record<string, Service[]> = {};
  services.forEach((s) => {
    const cat = s.subcategory || s.category || 'Otros';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  });
  const sortedCats = Object.keys(grouped).sort((a, b) => a === 'Otros' ? 1 : b === 'Otros' ? -1 : a.localeCompare(b, 'es'));

  return (
    <div className="space-y-6">
      {sortedCats.map((cat) => (
        <div key={cat}>
          <div className="mb-3">
            <h3 className="text-sm font-bold text-gray-900">{cat}</h3>
            <p className="text-[11px] text-gray-400">{grouped[cat].length} servicio{grouped[cat].length !== 1 ? 's' : ''}</p>
          </div>
          <div className="space-y-3">
            {grouped[cat].map((svc) => {
              const isExpanded = expandedSvcs.has(svc.id);
              const empsData = getEmployeesForService(svc.id);
              const assignedCount = empsData.filter((e) => e.assigned).length;
              const changed = hasSvcChanges(svc.id);

              return (
                <div key={svc.id} ref={(el) => { if (el) svcRefs.current.set(svc.id, el); }} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Header */}
                  <button
                    onClick={() => setExpandedSvcs((prev) => {
                      const next = new Set(prev);
                      next.has(svc.id) ? next.delete(svc.id) : next.add(svc.id);
                return next;
              })}
              className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-bold text-gray-900">{svc.name}</p>
                <p className="text-xs text-gray-400">{assignedCount} de {allEmployees.length} empleados · {svc.durationMinutes} min</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">{formatCurrency(svc.price, svc.currency)}</span>
                {savedSvcId === svc.id && <span className="text-xs text-green-600 font-medium">Guardado</span>}
                {changed && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {isExpanded && (
              <>
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                      <tr className="text-xs text-gray-500 uppercase">
                        <th className="w-8 px-2 py-2"></th>
                        <th className="text-left px-2 py-2 font-semibold">Empleado</th>
                        <th className="text-center px-2 py-2 font-semibold w-24">Precio</th>
                        <th className="text-center px-2 py-2 font-semibold w-28">Comisión</th>
                        <th className="text-center px-2 py-2 font-semibold w-24">Ganancia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empsData.map(({ emp, assigned, commission }) => {
                        const svcEdits = editingComm.get(svc.id);
                        const isToggled = svcEdits?.get(emp.id) === '__TOGGLE__';
                        const isAdding = !assigned && svcEdits?.has(emp.id) && !isToggled;
                        const isSelected = (assigned && !isToggled) || isAdding;
                        const commValue = getEditedComm(svc.id, emp.id, commission);
                        const price = Number(svc.price);
                        const comm = commValue ? Number(commValue) : 0;
                        const profit = price - comm;

                        return (
                          <tr key={emp.id} className={`border-t border-gray-100 ${isSelected ? 'bg-teal-50/30' : ''}`}>
                            <td className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (assigned && !isToggled) {
                                    setComm(svc.id, emp.id, '__TOGGLE__');
                                  } else if (isToggled) {
                                    setEditingComm((prev) => {
                                      const next = new Map(prev);
                                      const m = new Map(next.get(svc.id) || []);
                                      m.delete(emp.id);
                                      next.set(svc.id, m);
                                      return next;
                                    });
                                  } else if (!assigned && !isAdding) {
                                    setComm(svc.id, emp.id, '');
                                  } else {
                                    setEditingComm((prev) => {
                                      const next = new Map(prev);
                                      const m = new Map(next.get(svc.id) || []);
                                      m.delete(emp.id);
                                      next.set(svc.id, m);
                                      return next;
                                    });
                                  }
                                }}
                                className="w-4 h-4 rounded border-gray-300 text-[#008080] focus:ring-[#008080]"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: emp.color || '#008080' }}>
                                  {emp.avatarUrl ? <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{emp.firstName[0]}{emp.lastName[0]}</>}
                                </div>
                                <span className={isSelected ? 'text-gray-900' : 'text-gray-400'}>{emp.firstName} {emp.lastName}</span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center text-gray-500 tabular-nums">{formatCurrency(price, svc.currency)}</td>
                            <td className="px-2 py-2 text-center">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                disabled={!isSelected}
                                placeholder="0"
                                value={isToggled ? '' : (svcEdits?.has(emp.id) ? (svcEdits.get(emp.id) || '') : (commission != null ? String(commission) : ''))}
                                onChange={(e) => setComm(svc.id, emp.id, e.target.value)}
                                className="w-24 text-right text-sm border border-gray-200 rounded px-2 py-1 tabular-nums disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                              />
                            </td>
                            <td className="px-2 py-2 text-center tabular-nums">
                              {isSelected && comm > 0 ? (
                                <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(profit, svc.currency)}</span>
                              ) : <span className="text-gray-300">--</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {changed && (
                  <div className="px-5 py-3 bg-teal-50 border-t border-teal-200 flex items-center justify-end">
                    <button
                      onClick={() => saveSvcChanges(svc.id)}
                      disabled={savingSvcId === svc.id}
                      className="text-xs font-medium text-white px-4 py-1.5 rounded-lg disabled:opacity-50"
                      style={{ backgroundColor: '#008080' }}
                    >
                      {savingSvcId === svc.id ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
              })}
            </div>
          </div>
      ))}
      {services.length === 0 && (
        <div className="text-center py-12 text-gray-400">No hay servicios configurados</div>
      )}
    </div>
  );
}

/* ─── Employee Services View — inline checkbox table like staff editor ─── */
function EmployeeServicesView({ employees, allServices }: { employees: any[]; allServices: Service[] }) {
  const { format: formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [configMaps, setConfigMaps] = useState<Map<string, Map<string, { commission: number | null }>>>(new Map());
  const [savingEmpId, setSavingEmpId] = useState<string | null>(null);
  const [savedEmpId, setSavedEmpId] = useState<string | null>(null);
  const [expandedEmps, setExpandedEmps] = useState<Set<string>>(new Set());
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const allServiceIds = new Set(allServices.map((s) => s.id));

  function buildInitialMap(empServices: any[]) {
    const m = new Map<string, { commission: number | null }>();
    for (const es of empServices) {
      const svcId = es.service?.id || es.serviceId;
      if (allServiceIds.has(svcId)) {
        m.set(svcId, { commission: es.commission != null ? Number(es.commission) : null });
      }
    }
    return m;
  }

  function getConfigMap(empId: string, empServices: any[]) {
    return configMaps.get(empId) || buildInitialMap(empServices);
  }

  function toggleService(empId: string, svcId: string, empServices: any[]) {
    setConfigMaps((prev) => {
      const next = new Map(prev);
      const current = next.get(empId) || buildInitialMap(empServices);
      const map = new Map(current);
      if (map.has(svcId)) {
        map.delete(svcId);
      } else {
        map.set(svcId, { commission: null });
      }
      next.set(empId, map);
      return next;
    });
  }

  function updateCommission(empId: string, svcId: string, value: string, empServices: any[]) {
    setConfigMaps((prev) => {
      const next = new Map(prev);
      const current = next.get(empId) || buildInitialMap(empServices);
      const map = new Map(current);
      const existing = map.get(svcId);
      if (existing) {
        map.set(svcId, { commission: value === '' ? null : parseFloat(value) });
      }
      next.set(empId, map);
      return next;
    });
  }

  function hasChanges(empId: string, empServices: any[]) {
    const map = configMaps.get(empId);
    if (!map) return false;
    const currentIds = new Set(empServices.map((es: any) => es.service?.id || es.serviceId));
    if (map.size !== currentIds.size) return true;
    for (const [svcId, config] of map) {
      if (!currentIds.has(svcId)) return true;
      const es = empServices.find((e: any) => (e.service?.id || e.serviceId) === svcId);
      if (!es) return true;
      const oldComm = es.commission != null ? Number(es.commission) : null;
      if ((config.commission ?? null) !== oldComm) return true;
    }
    return false;
  }

  async function saveChanges(empId: string, empServices: any[]) {
    const map = getConfigMap(empId, empServices);
    setSavingEmpId(empId);
    try {
      await api.put(`/api/employees/${empId}/services`, {
        services: Array.from(map.entries()).map(([serviceId, config]) => ({
          serviceId,
          commission: config.commission,
        })),
      });
      queryClient.invalidateQueries({ queryKey: ['employees-for-commissions'] });
      setConfigMaps((prev) => { const n = new Map(prev); n.delete(empId); return n; });
      setSavedEmpId(empId);
      setTimeout(() => setSavedEmpId(null), 2000);
    } catch (err) {
      console.error('Error saving:', err);
    }
    setSavingEmpId(null);
  }

  return (
    <div className="space-y-4">
      {employees.map((emp: any) => {
        const empServices = (emp.employeeServices || []) as any[];
        const map = getConfigMap(emp.id, empServices);
        const changed = hasChanges(emp.id, empServices);
        const isExpanded = expandedEmps.has(emp.id);

        return (
          <div key={emp.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header — clickable to expand/collapse */}
            <button
              onClick={() => setExpandedEmps((prev) => {
                const next = new Set(prev);
                next.has(emp.id) ? next.delete(emp.id) : next.add(emp.id);
                return next;
              })}
              className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: emp.color || '#008080' }}>
                  {emp.avatarUrl ? <img src={`${API_URL}${emp.avatarUrl}`} alt="" className="w-full h-full object-cover" /> : <>{emp.firstName[0]}{emp.lastName[0]}</>}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{emp.firstName} {emp.lastName}</p>
                  <p className="text-xs text-gray-400">{map.size} de {allServices.length} servicios</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {savedEmpId === emp.id && <span className="text-xs text-green-600 font-medium">Guardado</span>}
                {changed && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Table — only shown when expanded */}
            {isExpanded && (
              <>
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                  <tr className="text-xs text-gray-500 uppercase">
                    <th className="w-8 px-2 py-2"></th>
                    <th className="text-left px-2 py-2 font-semibold">Servicio</th>
                    <th className="text-center px-2 py-2 font-semibold w-24">Precio</th>
                    <th className="text-center px-2 py-2 font-semibold w-28">Comisión</th>
                    <th className="text-center px-2 py-2 font-semibold w-24">Ganancia</th>
                  </tr>
                </thead>
                <tbody>
                  {allServices.map((svc) => {
                    const isSelected = map.has(svc.id);
                    const config = map.get(svc.id);
                    const price = Number(svc.price);
                    const comm = config?.commission ?? 0;
                    const profit = price - Number(comm);

                    return (
                      <tr key={svc.id} className={`border-t border-gray-100 ${isSelected ? 'bg-teal-50/30' : ''}`}>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleService(emp.id, svc.id, empServices)}
                            className="w-4 h-4 rounded border-gray-300 text-[#008080] focus:ring-[#008080]"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <span className={isSelected ? 'text-gray-900' : 'text-gray-400'}>{svc.name}</span>
                          <span className="text-xs text-gray-400 ml-1">({svc.durationMinutes}min)</span>
                        </td>
                        <td className="px-2 py-2 text-center text-gray-500 tabular-nums">{formatCurrency(price, svc.currency)}</td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={!isSelected}
                            placeholder="0"
                            value={config?.commission ?? ''}
                            onChange={(e) => updateCommission(emp.id, svc.id, e.target.value, empServices)}
                            className="w-24 text-right text-sm border border-gray-200 rounded px-2 py-1 tabular-nums disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                          />
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums">
                          {isSelected && config?.commission != null ? (
                            <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(profit, svc.currency)}</span>
                          ) : <span className="text-gray-300">--</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Save bar */}
            {changed && (
              <div className="px-5 py-3 bg-teal-50 border-t border-teal-200 flex items-center justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); saveChanges(emp.id, empServices); }}
                  disabled={savingEmpId === emp.id}
                  className="text-xs font-medium text-white px-4 py-1.5 rounded-lg disabled:opacity-50"
                  style={{ backgroundColor: '#008080' }}
                >
                  {savingEmpId === emp.id ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            )}
              </>
            )}
          </div>
        );
      })}
      {employees.length === 0 && (
        <div className="text-center py-12 text-gray-400">No hay empleados activos</div>
      )}
    </div>
  );
}
