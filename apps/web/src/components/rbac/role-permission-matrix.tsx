'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Permission {
  id: string;
  name: string;
  description?: string;
  module: string;
  action: string;
}

interface RolePermission {
  permissionId: string;
}

interface RolePermissionMatrixProps {
  roleId: string;
  roleName: string;
  isSystemRole?: boolean;
  onSave?: () => void;
}

const MODULE_LABELS: Record<string, string> = {
  appointments: 'Citas',
  clients: 'Clientes',
  services: 'Servicios',
  employees: 'Personal',
  resources: 'Recursos',
  payments: 'Pagos',
  reports: 'Reportes',
  roles: 'Roles',
  permissions: 'Permisos',
  locations: 'Ubicaciones',
  tenants: 'Configuración',
  audit: 'Auditoría',
};

const ACTION_LABELS: Record<string, string> = {
  read: 'Ver',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
  manage: 'Administrar',
  cancel: 'Cancelar',
  complete: 'Completar',
};

export function RolePermissionMatrix({
  roleId,
  roleName,
  isSystemRole = false,
  onSave,
}: RolePermissionMatrixProps) {
  const queryClient = useQueryClient();
  const [checkedPermissions, setCheckedPermissions] = useState<Set<string>>(
    new Set(),
  );
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(),
  );
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch all permissions
  const { data: permissionsData, isLoading: loadingPermissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.get<{ data: Permission[] }>('/api/permissions'),
  });

  // Fetch role's current permissions
  const { data: rolePermissionsData, isLoading: loadingRolePerms } = useQuery({
    queryKey: ['role-permissions', roleId],
    queryFn: () =>
      api.get<{ data: RolePermission[] }>(
        `/api/roles/${roleId}/permissions`,
      ),
    enabled: !!roleId,
  });

  useEffect(() => {
    if (rolePermissionsData?.data) {
      const permIds = new Set(
        rolePermissionsData.data.map((rp) => rp.permissionId),
      );
      setCheckedPermissions(permIds);
      setHasChanges(false);
    }
  }, [rolePermissionsData]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/api/roles/${roleId}/permissions`, {
        permissionIds: Array.from(checkedPermissions),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions', roleId] });
      setHasChanges(false);
      onSave?.();
    },
  });

  // API returns permissions already grouped by module: { data: { module: Permission[] } }
  // Or as a flat array — handle both formats
  const rawPerms = permissionsData?.data;
  let grouped: Record<string, Permission[]> = {};
  if (Array.isArray(rawPerms)) {
    grouped = rawPerms.reduce<Record<string, Permission[]>>(
      (acc, perm) => {
        if (!acc[perm.module]) acc[perm.module] = [];
        acc[perm.module].push(perm);
        return acc;
      },
      {},
    );
  } else if (rawPerms && typeof rawPerms === 'object') {
    grouped = rawPerms as Record<string, Permission[]>;
  }

  const permissions = Object.values(grouped).flat();

  function togglePermission(permId: string) {
    if (isSystemRole) return;
    setCheckedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) {
        next.delete(permId);
      } else {
        next.add(permId);
      }
      return next;
    });
    setHasChanges(true);
  }

  function toggleModule(module: string, perms: Permission[]) {
    if (isSystemRole) return;
    const allChecked = perms.every((p) => checkedPermissions.has(p.id));
    setCheckedPermissions((prev) => {
      const next = new Set(prev);
      perms.forEach((p) => {
        if (allChecked) {
          next.delete(p.id);
        } else {
          next.add(p.id);
        }
      });
      return next;
    });
    setHasChanges(true);
  }

  function toggleModuleExpand(module: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  }

  const isLoading = loadingPermissions || loadingRolePerms;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{roleName}</h2>
          <p className="text-sm text-gray-500">
            {isSystemRole
              ? 'Rol del sistema — no editable'
              : `${checkedPermissions.size} permiso${checkedPermissions.size !== 1 ? 's' : ''} asignado${checkedPermissions.size !== 1 ? 's' : ''}`}
          </p>
        </div>
        {!isSystemRole && hasChanges && (
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="btn-primary"
          >
            {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {Object.entries(grouped).map(([module, perms]) => {
          const allChecked = perms.every((p) => checkedPermissions.has(p.id));
          const someChecked = perms.some((p) => checkedPermissions.has(p.id));
          const isExpanded = expandedModules.has(module);

          return (
            <div
              key={module}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Module header */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleModuleExpand(module)}
              >
                <div className="flex items-center gap-3">
                  {/* Module checkbox */}
                  {!isSystemRole && (
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = someChecked && !allChecked;
                      }}
                      onChange={() => toggleModule(module, perms)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 text-primary-600 rounded border-gray-300 cursor-pointer"
                    />
                  )}
                  <span className="font-medium text-gray-900">
                    {MODULE_LABELS[module] || module}
                  </span>
                  <span className="text-xs text-gray-400">
                    {perms.filter((p) => checkedPermissions.has(p.id)).length}/
                    {perms.length}
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>

              {/* Permissions list */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {perms.map((perm) => (
                    <label
                      key={perm.id}
                      className={`flex items-center gap-3 px-6 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 ${
                        isSystemRole ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checkedPermissions.has(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        disabled={isSystemRole}
                        className="w-4 h-4 text-primary-600 rounded border-gray-300 disabled:opacity-60"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">
                          {ACTION_LABELS[perm.action] || perm.action}
                        </p>
                        {perm.description && (
                          <p className="text-xs text-gray-400">
                            {perm.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 font-mono">
                        {perm.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isSystemRole && hasChanges && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="btn-primary"
          >
            {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  );
}
