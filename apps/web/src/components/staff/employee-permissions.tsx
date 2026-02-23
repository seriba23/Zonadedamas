'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { EmployeeTimeOffEditor } from '@/components/staff/employee-time-off-editor';

interface Permission {
  id: string;
  module: string;
  action: string;
  description?: string | null;
}

interface EmployeeRole {
  userRoleId: string;
  roleId: string;
  roleName: string;
  roleSlug: string;
  isSystem: boolean;
  permissions: Permission[];
}

interface EmployeeRolesData {
  userId: string | null;
  roles: EmployeeRole[];
}

interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isSystem: boolean;
}

type PermissionsSection = 'roles' | 'ausencias';

export function EmployeePermissions({
  employeeId,
  canManage,
}: {
  employeeId: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<PermissionsSection>('roles');
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');

  const { data: rolesData, isLoading: loadingRoles } = useQuery({
    queryKey: ['employee-roles', employeeId],
    queryFn: () =>
      api.get<{ data: EmployeeRolesData }>(
        `/api/employees/${employeeId}/roles`,
      ),
    enabled: !!employeeId,
  });

  const { data: allRolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get<{ data: Role[] }>('/api/roles'),
    enabled: canManage,
  });

  const employeeRoles = rolesData?.data;
  const allRoles = allRolesData?.data || [];

  // Filter out roles already assigned
  const assignedRoleIds = new Set(
    employeeRoles?.roles.map((r) => r.roleId) || [],
  );
  const availableRoles = allRoles.filter((r) => !assignedRoleIds.has(r.id));

  const assignMutation = useMutation({
    mutationFn: (roleId: string) =>
      api.post('/api/user-roles', {
        userId: employeeRoles?.userId,
        roleId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['employee-roles', employeeId],
      });
      setSelectedRoleId('');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userRoleId: string) =>
      api.delete(`/api/user-roles/${userRoleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['employee-roles', employeeId],
      });
    },
  });

  // Group all permissions across roles by module
  const allPermissions = (employeeRoles?.roles || []).flatMap((r) => r.permissions);
  const uniquePermissions = Array.from(
    new Map(allPermissions.map((p) => [p.id, p])).values(),
  );
  const groupedPermissions = uniquePermissions.reduce(
    (acc, perm) => {
      if (!acc[perm.module]) acc[perm.module] = [];
      acc[perm.module].push(perm);
      return acc;
    },
    {} as Record<string, Permission[]>,
  );

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: 'roles' as PermissionsSection, label: 'Roles' },
          { key: 'ausencias' as PermissionsSection, label: 'Ausencias' },
        ]).map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => setActiveSection(section.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeSection === section.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Section: Roles */}
      {activeSection === 'roles' && (
        <>
          {loadingRoles ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !employeeRoles?.userId ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <svg
                className="w-12 h-12 text-gray-300 mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <p className="text-gray-500 text-sm">
                Este empleado no tiene un usuario vinculado al sistema.
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Para gestionar permisos, primero vincule un usuario al empleado.
              </p>
            </div>
          ) : (
            <>
              {/* Assigned Roles */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Roles asignados</h3>

                {employeeRoles.roles.length === 0 ? (
                  <p className="text-sm text-gray-400">No tiene roles asignados</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {employeeRoles.roles.map((role) => (
                      <div
                        key={role.userRoleId}
                        className="inline-flex items-center gap-1.5 bg-primary-50 text-primary-700 px-3 py-1.5 rounded-full text-sm font-medium"
                      >
                        {role.roleName}
                        {role.isSystem && (
                          <span className="text-xs text-primary-400">(sistema)</span>
                        )}
                        {canManage && !role.isSystem && (
                          <button
                            onClick={() => removeMutation.mutate(role.userRoleId)}
                            disabled={removeMutation.isPending}
                            className="ml-1 p-0.5 rounded-full hover:bg-primary-100 text-primary-400 hover:text-primary-600"
                            title="Quitar rol"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add role */}
                {canManage && availableRoles.length > 0 && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                    <select
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(e.target.value)}
                      className="input-field text-sm flex-1"
                    >
                      <option value="">Seleccionar rol...</option>
                      {availableRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (selectedRoleId) assignMutation.mutate(selectedRoleId);
                      }}
                      disabled={!selectedRoleId || assignMutation.isPending}
                      className="btn-primary text-sm"
                    >
                      {assignMutation.isPending ? 'Asignando...' : 'Agregar'}
                    </button>
                  </div>
                )}
              </div>

              {/* Permissions summary */}
              {Object.keys(groupedPermissions).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">Permisos efectivos</h3>
                  <div className="space-y-2">
                    {Object.entries(groupedPermissions)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([module, perms]) => (
                        <div key={module} className="border border-gray-100 rounded-lg">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRole(expandedRole === module ? null : module)
                            }
                            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700 capitalize">
                                {module}
                              </span>
                              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                {perms.length}
                              </span>
                            </div>
                            <svg
                              className={`w-4 h-4 text-gray-400 transition-transform ${
                                expandedRole === module ? 'rotate-180' : ''
                              }`}
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
                          </button>
                          {expandedRole === module && (
                            <div className="px-3 pb-3 space-y-1">
                              {perms
                                .sort((a, b) => a.action.localeCompare(b.action))
                                .map((perm) => (
                                  <div
                                    key={perm.id}
                                    className="flex items-center gap-2 text-sm pl-2"
                                  >
                                    <svg
                                      className="w-3.5 h-3.5 text-green-500 flex-shrink-0"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                    <span className="text-gray-600">{perm.action}</span>
                                    {perm.description && (
                                      <span className="text-xs text-gray-400">
                                        — {perm.description}
                                      </span>
                                    )}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Section: Ausencias */}
      {activeSection === 'ausencias' && (
        <EmployeeTimeOffEditor employeeId={employeeId} />
      )}
    </div>
  );
}
