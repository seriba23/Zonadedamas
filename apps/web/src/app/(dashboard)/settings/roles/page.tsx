'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Modal } from '@/components/ui/modal';
import { RolePermissionMatrix } from '@/components/rbac/role-permission-matrix';

interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
}

export default function RolesPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get<{ data: Role[] }>('/api/roles'),
  });

  const roles = data?.data || [];

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; description: string }) =>
      api.post('/api/roles', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setIsCreateModalOpen(false);
      setNewRoleName('');
      setNewRoleDesc('');
      setCreateError(null);
    },
    onError: (err: { message?: string }) => {
      setCreateError(err.message || 'Error al crear el rol');
    },
  });

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  return (
    <div className="flex flex-col h-full">
      <Header title="Roles y Permisos" />

      <div className="flex-1 flex overflow-hidden">
        {/* Roles list - left panel */}
        <div className="w-72 border-r border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Roles
            </h2>
            {hasPermission('roles:create') && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                + Nuevo
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {isLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 bg-gray-100 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : roles.length === 0 ? (
              <p className="p-4 text-sm text-gray-400 text-center">
                No hay roles
              </p>
            ) : (
              roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    selectedRoleId === role.id
                      ? 'bg-primary-50 border-r-2 border-r-primary-600'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {role.name}
                    </p>
                    {role.isSystem && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        Sistema
                      </span>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {role.description}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Permissions matrix - right panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedRoleId ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <p className="text-sm">
                  Selecciona un rol para ver sus permisos
                </p>
              </div>
            </div>
          ) : (
            <RolePermissionMatrix
              roleId={selectedRoleId}
              roleName={selectedRole?.name || ''}
              isSystemRole={selectedRole?.isSystem || false}
            />
          )}
        </div>
      </div>

      {isCreateModalOpen && (
        <Modal
          title="Nuevo Rol"
          onClose={() => {
            setIsCreateModalOpen(false);
            setCreateError(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newRoleName.trim()) {
                setCreateError('El nombre es requerido');
                return;
              }
              createMutation.mutate({
                name: newRoleName,
                description: newRoleDesc,
              });
            }}
            className="space-y-4"
          >
            {createError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                {createError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="input-field"
                placeholder="Ej: Recepcionista"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <input
                type="text"
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                className="input-field"
                placeholder="Descripción del rol..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending ? 'Creando...' : 'Crear Rol'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
