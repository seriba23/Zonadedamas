'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Modal } from '@/components/ui/modal';

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

export default function SuppliersPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page],
    queryFn: () =>
      api.get<{ data: Supplier[]; meta: { total: number; page: number; perPage: number; totalPages: number } }>(
        `/api/suppliers?page=${page}&perPage=${perPage}`,
      ),
  });

  const suppliers = data?.data || [];
  const meta = data?.meta;

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => {
      if (editingSupplier) {
        return api.put(`/api/suppliers/${editingSupplier.id}`, payload);
      }
      return api.post('/api/suppliers', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
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

  return (
    <div className="flex flex-col h-full">
      <Header title="Proveedores" />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            {meta?.total ?? suppliers.length} proveedor{(meta?.total ?? suppliers.length) !== 1 ? 'es' : ''}
          </p>
          {hasPermission('inventory.create') && (
            <button onClick={openCreate} className="btn-primary">
              + Agregar Proveedor
            </button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="animate-pulse p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 bg-gray-200 rounded w-1/5" />
                  <div className="h-4 bg-gray-200 rounded w-1/6" />
                  <div className="h-4 bg-gray-200 rounded w-1/5" />
                  <div className="h-4 bg-gray-200 rounded w-1/6" />
                  <div className="h-4 bg-gray-200 rounded w-1/12" />
                </div>
              ))}
            </div>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No hay proveedores registrados</p>
            {hasPermission('inventory.create') && (
              <button onClick={openCreate} className="btn-primary">
                Agregar primer proveedor
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{supplier.name}</div>
                        {supplier.address && (
                          <div className="text-xs text-gray-400 line-clamp-1">{supplier.address}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{supplier.contactName || '-'}</td>
                      <td className="px-4 py-3">
                        {supplier.email ? (
                          <a
                            href={`mailto:${supplier.email}`}
                            className="text-primary-600 hover:text-primary-700 hover:underline"
                          >
                            {supplier.email}
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{supplier.phone || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                          {supplier._count?.products ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {supplier.isActive ? (
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
                              onClick={() => openEdit(supplier)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                              title="Editar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                          )}
                          {hasPermission('inventory.delete') && (
                            <button
                              onClick={() => setDeleteConfirm(supplier.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                              title="Eliminar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
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

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Mostrando {(meta.page - 1) * meta.perPage + 1} -{' '}
                  {Math.min(meta.page * meta.perPage, meta.total)} de {meta.total}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                    disabled={page >= meta.totalPages}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <Modal
          title={editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
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
                placeholder="Ej: L'Oreal Professional"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Persona de contacto</label>
              <input
                type="text"
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                className="input-field"
                placeholder="Nombre del contacto"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="input-field"
                  placeholder="contacto@proveedor.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="input-field"
                  placeholder="+1 (809) 555-0000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="input-field"
                placeholder="Dirección del proveedor"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="input-field resize-none"
                rows={2}
                placeholder="Notas adicionales..."
              />
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
