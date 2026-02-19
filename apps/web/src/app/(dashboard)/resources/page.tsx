'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';

interface Resource {
  id: string;
  name: string;
  type: string;
  locationId?: string;
  location?: { name: string };
  isActive: boolean;
}

interface ResourceForm {
  name: string;
  type: string;
  locationId: string;
}

const defaultForm: ResourceForm = { name: '', type: 'room', locationId: '' };

const RESOURCE_TYPES = [
  { value: 'room', label: 'Habitación' },
  { value: 'chair', label: 'Silla' },
  { value: 'table', label: 'Mesa' },
  { value: 'equipment', label: 'Equipo' },
  { value: 'other', label: 'Otro' },
];

export default function ResourcesPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [form, setForm] = useState<ResourceForm>(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: () => api.get<{ data: Resource[] }>('/api/resources'),
  });

  const resources = data?.data || [];

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Resource>) => {
      if (editingResource) {
        return api.put(`/api/resources/${editingResource.id}`, payload);
      }
      return api.post('/api/resources', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      closeModal();
    },
    onError: (err: { message?: string }) => {
      setFormError(err.message || 'Error al guardar el recurso');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (resource: Resource) =>
      api.put(`/api/resources/${resource.id}`, { isActive: !resource.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });

  function openCreate() {
    setEditingResource(null);
    setForm(defaultForm);
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEdit(resource: Resource) {
    setEditingResource(resource);
    setForm({
      name: resource.name,
      type: resource.type,
      locationId: resource.locationId || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingResource(null);
    setForm(defaultForm);
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('El nombre es requerido');
      return;
    }
    saveMutation.mutate(form);
  }

  function getTypeLabel(type: string) {
    return RESOURCE_TYPES.find((t) => t.value === type)?.label || type;
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Recursos" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            {resources.length} recurso{resources.length !== 1 ? 's' : ''}
          </p>
          {hasPermission('resources:create') && (
            <button onClick={openCreate} className="btn-primary">
              + Nuevo Recurso
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Ubicación
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : resources.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <p className="text-gray-500 text-sm">
                      No hay recursos configurados
                    </p>
                    {hasPermission('resources:create') && (
                      <button
                        onClick={openCreate}
                        className="mt-3 btn-primary text-sm"
                      >
                        Agregar recurso
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                resources.map((resource) => (
                  <tr key={resource.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {resource.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {getTypeLabel(resource.type)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {resource.location?.name || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={resource.isActive ? 'success' : 'default'}
                        size="sm"
                      >
                        {resource.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {hasPermission('resources:update') && (
                          <>
                            <button
                              onClick={() => openEdit(resource)}
                              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => toggleActiveMutation.mutate(resource)}
                              className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                            >
                              {resource.isActive ? 'Desactivar' : 'Activar'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <Modal
          title={editingResource ? 'Editar Recurso' : 'Nuevo Recurso'}
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo *
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value }))
                }
                className="input-field"
              >
                {RESOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
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
