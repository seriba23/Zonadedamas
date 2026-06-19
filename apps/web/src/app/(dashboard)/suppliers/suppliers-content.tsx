'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Modal } from '@/components/ui/modal';
import { useRegisterTopbarAction } from '@/lib/hooks/use-topbar-action';

interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  _count?: { products: number };
}

interface SupplierForm {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  isActive: boolean;
}

const defaultForm: SupplierForm = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
  isActive: true,
};

export function SuppliersContent({ embedded }: { embedded?: boolean } = {}) {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Filters modal + filter state (search en client-side dentro de los campos)
  const [showFilters, setShowFilters] = useState(false);
  // APLICADOS — disparan el filtrado del listado.
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  // DRAFT — se editan dentro del modal, solo entran en vigor al darle "Aplicar".
  const [draftSearch, setDraftSearch] = useState(search);
  const [draftFilterActive, setDraftFilterActive] = useState<'all' | 'active' | 'inactive'>(filterActive);

  // Detalle (read-only) — se abre al clickear card/fila
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const router = useRouter();
  function verProductosDeProveedor(supplierId: string) {
    setViewingSupplier(null);
    router.push(`/inventory?supplierId=${supplierId}`);
  }

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () =>
      api.get<{ data: Supplier[]; meta: { total: number } }>(
        `/api/suppliers?perPage=100`,
      ),
  });

  const allSuppliers = data?.data || [];

  // Filtrado client-side por busqueda libre + estado activo
  const suppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allSuppliers.filter((s) => {
      if (filterActive === 'active' && !s.isActive) return false;
      if (filterActive === 'inactive' && s.isActive) return false;
      if (!q) return true;
      const hay = [s.name, s.contactName, s.email, s.phone, s.address, s.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [allSuppliers, search, filterActive]);

  const hasActiveFilters = search.trim().length > 0 || filterActive !== 'all';
  const hasDraftFilters = draftSearch.trim().length > 0 || draftFilterActive !== 'all';

  function openFilters() {
    setDraftSearch(search);
    setDraftFilterActive(filterActive);
    setShowFilters(true);
  }

  function applyFilters() {
    setSearch(draftSearch);
    setFilterActive(draftFilterActive);
    setShowFilters(false);
  }

  function clearDraftFilters() {
    setDraftSearch('');
    setDraftFilterActive('all');
  }

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => {
      if (editingSupplier) {
        return api.put(`/api/suppliers/${editingSupplier.id}`, payload);
      }
      return api.post('/api/suppliers', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-for-products'] });
      closeModal();
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al guardar el proveedor');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-for-products'] });
      setDeleteConfirm(null);
    },
  });

  function openCreate() {
    setEditingSupplier(null);
    setForm(defaultForm);
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      contactName: supplier.contactName || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
      isActive: supplier.isActive,
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingSupplier(null);
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
      contactName: form.contactName || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      notes: form.notes || null,
      isActive: form.isActive,
    };
    saveMutation.mutate(payload);
  }

  // Topbar action: "+ Nuevo" (solo si tiene permiso)
  useRegisterTopbarAction(
    !embedded && hasPermission('inventory.create') ? (
      <button
        onClick={openCreate}
        className="px-2.5 md:px-3.5 py-1.5 text-[12px] md:text-sm font-semibold rounded-lg bg-[#008080] text-white hover:bg-[#006666] transition-colors whitespace-nowrap"
      >
        + Nuevo
      </button>
    ) : null,
    [embedded, hasPermission('inventory.create')],
  );

  return (
    <div className={embedded ? '' : 'flex flex-col h-full'}>
      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {/* Header: contador + boton de filtros */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {suppliers.length} proveedor{suppliers.length !== 1 ? 'es' : ''}
          </p>
          <button
            onClick={openFilters}
            aria-label="Mostrar filtros"
            className={`flex-shrink-0 p-1.5 md:p-2 rounded-lg border transition-colors ${
              hasActiveFilters
                ? 'bg-[#008080] border-[#008080] text-white'
                : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
            }`}
            title="Filtros"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        </div>

        {/* Empty / loading / list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]">
                <div className="w-14 h-14 rounded-xl bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : allSuppliers.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No hay proveedores registrados</p>
            {hasPermission('inventory.create') && (
              <button onClick={openCreate} className="btn-primary">
                Agregar primer proveedor
              </button>
            )}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">No hay proveedores que coincidan con los filtros</p>
          </div>
        ) : (
          <>
            {/* MOBILE / PWA: cards (solo nombre + direccion) */}
            <ul className="space-y-3 md:hidden">
              {suppliers.map((sup) => (
                <li key={sup.id}>
                  <button
                    type="button"
                    onClick={() => setViewingSupplier(sup)}
                    className="w-full text-left grid items-center gap-x-3 px-3 py-3 rounded-2xl border border-[var(--border)] hover:bg-[var(--bg-muted)] cursor-pointer transition-colors"
                    style={{ backgroundColor: 'var(--bg-surface)', gridTemplateColumns: 'auto 1fr' }}
                  >
                    {/* Icono de proveedor (mismo tamano que la imagen de productos) */}
                    <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                      </svg>
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm md:text-base font-semibold text-[var(--text-primary)] truncate">
                        {sup.name}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                        {sup.address || '—'}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {/* DESKTOP: tabla */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Contacto</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Teléfono</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Productos</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {suppliers.map((sup) => (
                      <tr
                        key={sup.id}
                        onClick={() => setViewingSupplier(sup)}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{sup.name}</div>
                          {sup.address && (
                            <div className="text-xs text-gray-400 line-clamp-1">{sup.address}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{sup.contactName || '—'}</td>
                        <td className="px-4 py-3">
                          {sup.email ? (
                            <a
                              href={`mailto:${sup.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary-600 hover:text-primary-700 hover:underline"
                            >
                              {sup.email}
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{sup.phone || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                            {sup._count?.products ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {sup.isActive ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                              Activo
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {hasPermission('inventory.update') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openEdit(sup); }}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                                title="Editar"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                            {hasPermission('inventory.delete') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(sup.id); }}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                                title="Eliminar"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filtros Modal */}
      {showFilters && (
        <Modal title="Filtros" onClose={() => setShowFilters(false)} size="md">
          <div className="space-y-5">
            {/* Búsqueda */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Buscar
              </label>
              <input
                type="text"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="Nombre, contacto, email, teléfono, dirección..."
                className="input-field text-sm py-2"
                autoFocus
              />
              <p className="text-xs text-[var(--text-muted)] mt-1.5">
                Busca dentro de todos los campos del proveedor
              </p>
            </div>

            {/* Estado */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                Estado
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'all', label: 'Todos' },
                  { key: 'active', label: 'Activos' },
                  { key: 'inactive', label: 'Inactivos' },
                ].map((opt) => {
                  const active = draftFilterActive === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setDraftFilterActive(opt.key as 'all' | 'active' | 'inactive')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        active
                          ? 'bg-[#008080] text-white border-[#008080]'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2 pt-4 border-t border-[var(--border)]">
              <button
                onClick={clearDraftFilters}
                disabled={!hasDraftFilters}
                className={`flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors whitespace-nowrap ${
                  hasDraftFilters
                    ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    : 'bg-[var(--bg-subtle)] border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed'
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

      {/* Detalle (read-only) */}
      {viewingSupplier && (() => {
        const s = viewingSupplier;
        const inlineRow = (label: string, value: React.ReactNode) => (
          <li key={label} className="flex items-start justify-between gap-3 px-3 py-2.5">
            <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0 pt-0.5">
              {label}
            </span>
            <span className="text-sm text-[var(--text-primary)] text-right break-words min-w-0">
              {value}
            </span>
          </li>
        );
        const stackRow = (label: string, value: React.ReactNode) => (
          <li key={label} className="px-3 py-2.5 space-y-1.5">
            <span className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
              {label}
            </span>
            <p className="text-sm text-[var(--text-primary)] break-words whitespace-pre-wrap" style={{ textAlign: 'justify' }}>
              {value}
            </p>
          </li>
        );
        return (
          <Modal title="Detalle del proveedor" onClose={() => setViewingSupplier(null)} size="md">
            <div className="space-y-4">
              {/* Icono grande */}
              <div className="flex justify-center">
                <div className="w-32 h-32 rounded-2xl bg-gray-100 flex items-center justify-center border border-[var(--border)]">
                  <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                  </svg>
                </div>
              </div>

              <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-surface)]">
                {inlineRow('Nombre', s.name)}
                {inlineRow('Persona de contacto', s.contactName || '—')}
                {inlineRow(
                  'Email',
                  s.email ? (
                    <a href={`mailto:${s.email}`} className="text-[#008080] hover:text-[#006666] underline break-all">
                      {s.email}
                    </a>
                  ) : (
                    '—'
                  ),
                )}
                {inlineRow(
                  'Teléfono',
                  s.phone ? (
                    <a href={`tel:${s.phone}`} className="text-[#008080] hover:text-[#006666] underline">
                      {s.phone}
                    </a>
                  ) : (
                    '—'
                  ),
                )}
                {s.address ? stackRow('Dirección', s.address) : inlineRow('Dirección', '—')}
                {stackRow('Notas', s.notes || '—')}
                {inlineRow(
                  'Productos asociados',
                  <button
                    onClick={() => verProductosDeProveedor(s.id)}
                    className="px-2 py-0.5 text-xs font-medium rounded-full bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                  >
                    {s._count?.products ?? 0} · Ver
                  </button>,
                )}
                {inlineRow(
                  'Estado',
                  s.isActive ? (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Activo</span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">Inactivo</span>
                  ),
                )}
              </ul>

              <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                {hasPermission('inventory.delete') && (
                  <button
                    onClick={() => {
                      setDeleteConfirm(s.id);
                      setViewingSupplier(null);
                    }}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors"
                  >
                    Eliminar
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => setViewingSupplier(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
                >
                  Cerrar
                </button>
                {hasPermission('inventory.update') && (
                  <button
                    onClick={() => {
                      setViewingSupplier(null);
                      openEdit(s);
                    }}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#008080] text-white hover:bg-[#006666] transition-colors"
                  >
                    Editar
                  </button>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <Modal
          title={editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          onClose={closeModal}
          size="md"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{formError}</div>
            )}

            {/* Icono grande (igual posicion que en detalle) */}
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded-2xl bg-gray-100 flex items-center justify-center border border-[var(--border)]">
                <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                </svg>
              </div>
            </div>

            {/* Lista de inputs (mismo orden que detalle) */}
            <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-surface)]">
              {/* Nombre */}
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0">
                  Nombre *
                </span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Ej: L'Oreal Professional"
                  className="flex-1 min-w-0 text-sm text-right bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                />
              </li>

              {/* Persona de contacto */}
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0">
                  Persona de contacto
                </span>
                <input
                  type="text"
                  value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  placeholder="Nombre del contacto"
                  className="flex-1 min-w-0 text-sm text-right bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                />
              </li>

              {/* Email */}
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0">
                  Email
                </span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="contacto@proveedor.com"
                  className="flex-1 min-w-0 text-sm text-right bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                />
              </li>

              {/* Teléfono */}
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide flex-shrink-0">
                  Teléfono
                </span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 (809) 555-0000"
                  className="flex-1 min-w-0 text-sm text-right bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                />
              </li>

              {/* Dirección — stack */}
              <li className="px-3 py-2.5 space-y-1.5">
                <span className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Dirección
                </span>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Dirección del proveedor"
                  className="w-full text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors"
                />
              </li>

              {/* Notas — stack */}
              <li className="px-3 py-2.5 space-y-1.5">
                <span className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Notas
                </span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Notas internas sobre el proveedor..."
                  className="w-full text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] hover:border-gray-400 focus:outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/20 transition-colors resize-none"
                />
              </li>

              {/* Estado / Activo */}
              <li className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Estado
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isActive}
                  onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                  style={{ backgroundColor: form.isActive ? '#008080' : 'var(--border)' }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                    style={{ transform: form.isActive ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </button>
              </li>
            </ul>

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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal title="Eliminar Proveedor" onClose={() => setDeleteConfirm(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              ¿Estás seguro de que deseas eliminar este proveedor? Los productos asociados quedarán sin proveedor.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
