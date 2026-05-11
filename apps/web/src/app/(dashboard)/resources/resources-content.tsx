'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Modal } from '@/components/ui/modal';
import { useCurrency } from '@/lib/hooks/use-currency';
import { DatePicker } from '@/components/ui/date-picker';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Resource {
  id: string;
  name: string;
  type?: string;
  description?: string;
  notes?: string;
  imageUrl?: string;
  imageUrl2?: string;
  imageUrl3?: string;
  value?: number;
  quantity?: number;
  locationQuantities?: Record<string, number>;
  serialNumber?: string;
  brand?: string;
  condition?: string;
  assignedTo?: string | null;
  assignedAt?: string;
  purchaseDate?: string;
  locationId: string;
  location?: { id: string; name: string };
  isActive: boolean;
}

interface ResourceForm {
  name: string;
  type: string;
  description: string;
  notes: string;
  value: string;
  locationQuantities: Record<string, number>;
  serialNumber: string;
  brand: string;
  condition: string;
  assignedTo: string;
  purchaseDate: string;
  locationId: string;
}

const defaultForm: ResourceForm = {
  name: '', type: 'equipment', description: '', notes: '', value: '',
  locationQuantities: {}, serialNumber: '', brand: '', condition: 'good', assignedTo: 'business',
  purchaseDate: '', locationId: '',
};

const RESOURCE_TYPES = [
  { value: 'chair', label: 'Silla' },
  { value: 'machine', label: 'Máquina' },
  { value: 'furniture', label: 'Mueble' },
  { value: 'tool', label: 'Herramienta' },
  { value: 'equipment', label: 'Equipo' },
  { value: 'electronics', label: 'Electrónico' },
  { value: 'vehicle', label: 'Vehículo' },
  { value: 'other', label: 'Otro' },
];

const CONDITIONS = [
  { value: 'new', label: 'Nuevo' },
  { value: 'good', label: 'Bueno' },
  { value: 'fair', label: 'Regular' },
  { value: 'poor', label: 'Malo' },
];

export function ResourcesContent({ embedded }: { embedded?: boolean } = {}) {
  const { hasPermission } = usePermissions();
  const { format: formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [form, setForm] = useState<ResourceForm>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterAssigned, setFilterAssigned] = useState('all');
  const [pendingFiles, setPendingFiles] = useState<(File | null)[]>([null, null, null]);
  const [previewUrls, setPreviewUrls] = useState<(string | null)[]>([null, null, null]);

  const { data, isLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: () => api.get<{ data: Resource[] }>('/api/resources?perPage=100'),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees-for-resources'],
    queryFn: () => api.get<{ data: any[] }>('/api/employees?perPage=100'),
  });

  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get<{ data: any[] }>('/api/locations'),
  });

  const resources = data?.data || [];
  const employees = (employeesData?.data || []).filter((e: any) => e.isActive);
  const locations = locationsData?.data || [];

  // Filters
  const filtered = resources.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      const match = r.name.toLowerCase().includes(q)
        || (r.brand || '').toLowerCase().includes(q)
        || (r.serialNumber || '').toLowerCase().includes(q)
        || (r.description || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (filterLocation !== 'all') {
      const locQty = r.locationQuantities as Record<string, number> | null;
      if (locQty) {
        if (!locQty[filterLocation] || locQty[filterLocation] <= 0) return false;
      } else {
        if (r.locationId !== filterLocation) return false;
      }
    }
    if (filterAssigned === 'business' && r.assignedTo !== 'business') return false;
    if (filterAssigned === 'employee' && (r.assignedTo === 'business' || !r.assignedTo)) return false;
    if (filterAssigned === 'unassigned' && r.assignedTo) return false;
    return true;
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editingResource) return api.put<{ data: Resource }>(`/api/resources/${editingResource.id}`, payload);
      return api.post<{ data: Resource }>('/api/resources', payload);
    },
    onSuccess: async (res: any) => {
      const id = res?.data?.id;
      if (id) {
        for (let i = 0; i < 3; i++) {
          if (pendingFiles[i]) {
            try { await api.uploadForm(`/api/resources/${id}/image/${i + 1}`, {}, pendingFiles[i]!); } catch {}
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      closeModal();
    },
    onError: (err: any) => setFormError(err.message || 'Error al guardar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/resources/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resources'] }),
  });

  function openCreate() {
    setEditingResource(null);
    const initQty: Record<string, number> = {};
    if (locations.length > 0) initQty[locations[0].id] = 1;
    setForm({ ...defaultForm, locationId: locations[0]?.id || '', locationQuantities: initQty });
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEdit(resource: Resource) {
    setEditingResource(resource);
    setForm({
      name: resource.name,
      type: resource.type || 'other',
      description: resource.description || '',
      notes: resource.notes || '',
      value: resource.value != null ? String(resource.value) : '',
      locationQuantities: (resource.locationQuantities as Record<string, number>) || { [resource.locationId]: resource.quantity || 1 },
      serialNumber: resource.serialNumber || '',
      brand: resource.brand || '',
      condition: resource.condition || 'good',
      assignedTo: resource.assignedTo || 'business',
      purchaseDate: resource.purchaseDate ? resource.purchaseDate.split('T')[0] : '',
      locationId: resource.locationId,
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function closeModal() { setIsModalOpen(false); setEditingResource(null); setForm(defaultForm); setFormError(null); setPendingFiles([null, null, null]); setPreviewUrls([null, null, null]); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('El nombre es requerido'); return; }
    const totalQty = Object.values(form.locationQuantities).reduce((s, q) => s + q, 0);
    if (totalQty < 1) { setFormError('Asigna al menos 1 unidad a una ubicación'); return; }

    const payload: any = {
      name: form.name,
      type: form.type,
      description: form.description || undefined,
      notes: form.notes || undefined,
      value: form.value ? Number(form.value) : undefined,
      locationQuantities: form.locationQuantities,
      serialNumber: form.serialNumber || undefined,
      brand: form.brand || undefined,
      condition: form.condition,
      assignedTo: form.assignedTo || null,
      purchaseDate: form.purchaseDate || undefined,
      locationId: form.locationId || Object.entries(form.locationQuantities).find(([, q]) => q > 0)?.[0] || locations[0]?.id,
    };
    saveMutation.mutate(payload);
  }

  function getTypeLabel(type?: string) {
    return RESOURCE_TYPES.find((t) => t.value === type)?.label || type || 'Sin tipo';
  }

  function getConditionLabel(condition?: string) {
    return CONDITIONS.find((c) => c.value === condition)?.label || condition || '';
  }

  function getConditionColor(condition?: string) {
    switch (condition) {
      case 'new': return 'bg-green-50 text-green-700';
      case 'good': return 'bg-teal-50 text-teal-700';
      case 'fair': return 'bg-gray-100 text-gray-600';
      case 'poor': return 'bg-red-50 text-red-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  function getAssignedName(assignedTo?: string | null) {
    if (!assignedTo || assignedTo === 'business') return 'Negocio';
    const emp = employees.find((e: any) => e.id === assignedTo);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Desconocido';
  }

  // Total value
  const totalUnits = filtered.reduce((sum, r) => sum + (r.quantity || 1), 0);
  const totalValue = filtered.reduce((sum, r) => sum + (Number(r.value) || 0) * (r.quantity || 1), 0);

  return (
    <div className={embedded ? '' : 'flex flex-col h-full'}>
      {!embedded && <Header title="Activos y Recursos" />}

      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400">Total activos</p>
            <p className="text-xl font-bold text-gray-900">{filtered.length} <span className="text-sm font-normal text-gray-400">({totalUnits} uds)</span></p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400">Valor total</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalValue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400">Asignados a empleados</p>
            <p className="text-xl font-bold text-gray-900">{resources.filter((r) => r.assignedTo && r.assignedTo !== 'business').length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400">En buen estado</p>
            <p className="text-xl font-bold text-gray-900">{resources.filter((r) => r.condition === 'good' || r.condition === 'new').length}</p>
          </div>
        </div>

        {/* Filters + Add button */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar activo..."
              className="text-xs border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 w-48 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
          >
            <option value="all">Todas las categorías</option>
            {RESOURCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
          >
            <option value="all">Todas las ubicaciones</option>
            {locations.map((loc: any) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
          <select
            value={filterAssigned}
            onChange={(e) => setFilterAssigned(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
          >
            <option value="all">Todos</option>
            <option value="business">Del negocio</option>
            <option value="employee">Asignado a empleado</option>
            <option value="unassigned">Sin asignar</option>
          </select>
          <div className="ml-auto">
            {hasPermission('resources.create') && (
              <button onClick={openCreate} className="btn-primary text-sm">+ Nuevo activo</button>
            )}
          </div>
        </div>

        {/* Resources grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">No hay activos registrados</p>
            {hasPermission('resources.create') && (
              <button onClick={openCreate} className="btn-primary">Registrar primer activo</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((resource) => (
              <div
                key={resource.id}
                onClick={() => openEdit(resource)}
                className={`bg-white rounded-xl border p-4 hover:shadow-md transition-all cursor-pointer ${resource.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
              >
                <div className="flex gap-3">
                  {/* Image */}
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center relative">
                    {resource.imageUrl ? (
                      <>
                        <img src={`${API_URL}${resource.imageUrl}`} alt="" className="w-full h-full object-cover" />
                        {(resource.imageUrl2 || resource.imageUrl3) && (
                          <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[8px] font-bold px-1 rounded">
                            +{(resource.imageUrl2 ? 1 : 0) + (resource.imageUrl3 ? 1 : 0)}
                          </span>
                        )}
                      </>
                    ) : (
                      <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{resource.name}</h3>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${getConditionColor(resource.condition)}`}>
                        {getConditionLabel(resource.condition)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {getTypeLabel(resource.type)}{resource.brand ? ` · ${resource.brand}` : ''}
                      {(resource.quantity || 1) > 1 && <span className="ml-1 font-medium text-gray-500">×{resource.quantity}</span>}
                    </p>
                    {resource.value != null && Number(resource.value) > 0 && (
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {formatCurrency(Number(resource.value) * (resource.quantity || 1))}
                        {(resource.quantity || 1) > 1 && <span className="text-[10px] text-gray-400 font-normal ml-1">({formatCurrency(Number(resource.value))} c/u)</span>}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                  {/* Location breakdown */}
                  {(() => {
                    const locQty = resource.locationQuantities as Record<string, number> | null;
                    if (locQty && Object.keys(locQty).length > 0) {
                      const entries = Object.entries(locQty).filter(([, q]) => q > 0);
                      if (entries.length > 0) {
                        return (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            {entries.map(([locId, q]) => {
                              const loc = locations.find((l: any) => l.id === locId);
                              return (
                                <span key={locId} className="text-[10px] text-gray-500">
                                  {loc?.name || '?'}: <span className="font-medium text-gray-700">{q}</span>
                                </span>
                              );
                            })}
                          </div>
                        );
                      }
                    }
                    return <span className="text-[11px] text-gray-400">{resource.location?.name}</span>;
                  })()}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                      </svg>
                      <span className="text-[11px] text-gray-500">{getAssignedName(resource.assignedTo)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <Modal title={editingResource ? 'Editar Activo' : 'Nuevo Activo'} onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {formError && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>}

            {/* Image upload - 3 slots */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fotos del activo</label>
              <div className="flex gap-3">
                {[0, 1, 2].map((slot) => {
                  const fields = ['imageUrl', 'imageUrl2', 'imageUrl3'] as const;
                  const existingUrl = editingResource?.[fields[slot]] as string | undefined;
                  const preview = previewUrls[slot];
                  const imgSrc = preview || (existingUrl ? `${API_URL}${existingUrl}` : null);

                  return (
                    <label key={slot} className="flex items-center justify-center w-28 h-28 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#008080] bg-gray-50 hover:bg-teal-50/30 cursor-pointer transition-colors overflow-hidden flex-shrink-0">
                      {imgSrc ? (
                        <img src={imgSrc} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center text-gray-300">
                          <svg className="w-6 h-6 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          <span className="text-[10px]">Foto {slot + 1}</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const newPreviews = [...previewUrls];
                          newPreviews[slot] = URL.createObjectURL(file);
                          setPreviewUrls(newPreviews);

                          if (editingResource) {
                            try {
                              const res = await api.uploadForm<{ data: any }>(
                                `/api/resources/${editingResource.id}/image/${slot + 1}`, {}, file,
                              );
                              queryClient.invalidateQueries({ queryKey: ['resources'] });
                              setEditingResource({ ...editingResource, [fields[slot]]: res.data[fields[slot]] });
                            } catch {}
                          } else {
                            const newFiles = [...pendingFiles];
                            newFiles[slot] = file;
                            setPendingFiles(newFiles);
                          }
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input-field" placeholder="Ej: Silla hidráulica #3" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="input-field">
                  {RESOURCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))} className="input-field">
                  {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                <input type="text" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} className="input-field" placeholder="Ej: Samsung" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Serie</label>
                <input type="text" value={form.serialNumber} onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} className="input-field" placeholder="Opcional" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor unitario</label>
                <input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} className="input-field" placeholder="0.00" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha compra</label>
                <DatePicker value={form.purchaseDate} onChange={(val) => setForm((f) => ({ ...f, purchaseDate: val }))} />
              </div>

              {/* Location quantities */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidades por ubicación</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {locations.map((loc: any) => {
                    const qty = form.locationQuantities[loc.id] ?? 0;
                    return (
                      <div key={loc.id} className="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-b-0">
                        <span className="text-sm text-gray-700">{loc.name}</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={qty}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setForm((f) => ({
                              ...f,
                              locationQuantities: { ...f.locationQuantities, [loc.id]: val },
                              locationId: f.locationId || loc.id,
                            }));
                          }}
                          className="w-20 text-center text-sm border border-gray-200 rounded-lg px-2 py-1 focus:border-[#008080] focus:ring-1 focus:ring-[#008080]"
                        />
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                    <span className="text-sm font-medium text-gray-900">Total</span>
                    <span className="text-sm font-bold text-gray-900 w-20 text-center">
                      {Object.values(form.locationQuantities).reduce((s, q) => s + q, 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asignado a</label>
                <select value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))} className="input-field">
                  <option value="business">Negocio (general)</option>
                  {employees.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="input-field resize-none" rows={2} placeholder="Descripción breve del activo..." />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="input-field resize-none" rows={2} placeholder="Notas adicionales (mantenimiento, garantía, etc.)" />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              {editingResource && hasPermission('resources.delete') && (
                <button
                  type="button"
                  onClick={() => { if (confirm('¿Desactivar este activo?')) { deleteMutation.mutate(editingResource.id); closeModal(); } }}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                >
                  Desactivar
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
                  {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
