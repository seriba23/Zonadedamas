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

const ADMIN_MODULES = [
  { key: 'appointments', label: 'Calendario', desc: 'Ver y gestionar citas' },
  { key: 'clients', label: 'Clientes', desc: 'Gestionar directorio de clientes' },
  { key: 'services', label: 'Servicios', desc: 'Configurar servicios y precios' },
  { key: 'employees', label: 'Personal', desc: 'Gestionar empleados y horarios' },
  { key: 'reports', label: 'Reportes', desc: 'Ver estadisticas e ingresos' },
  { key: 'inventory', label: 'Inventario', desc: 'Productos y proveedores' },
  { key: 'rewards', label: 'Cupones', desc: 'Cupones, descuentos, 2×1 y fidelidad' },
  { key: 'resources', label: 'Recursos', desc: 'Salas y equipamiento' },
  { key: 'locations', label: 'Sucursales', desc: 'Gestionar ubicaciones' },
];

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
  const [adminModules, setAdminModules] = useState<Set<string>>(new Set());
  const [savedModules, setSavedModules] = useState<Set<string>>(new Set());
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminSuccess, setAdminSuccess] = useState('');

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

  // Detect if employee has admin-like role (not staff/readonly)
  const hasAdminRole = (employeeRoles?.roles || []).some(
    (r) => r.roleSlug === 'admin' || r.roleSlug === 'manager' || r.roleSlug === 'owner' || r.roleName === 'Ayudante',
  );
  const helperRole = (employeeRoles?.roles || []).find((r) => r.roleName === 'Ayudante');

  // Initialize admin modules from existing helper role
  useState(() => {
    if (helperRole) {
      const mods = new Set(helperRole.permissions.map((p) => p.module));
      setAdminModules(mods);
      setSavedModules(mods);
    }
  });

  function toggleModule(mod: string) {
    setAdminModules((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  }

  // Check if there are unsaved changes
  const hasChanges = (() => {
    if (adminModules.size !== savedModules.size) return true;
    for (const m of adminModules) if (!savedModules.has(m)) return true;
    return false;
  })();

  async function saveAdminAccess(enable: boolean) {
    if (!employeeRoles?.userId) return;
    setSavingAdmin(true);
    setAdminSuccess('');
    try {
      if (enable && adminModules.size > 0) {
        await api.post(`/api/employees/${employeeId}/admin-access`, {
          modules: Array.from(adminModules),
        });
        const names = ADMIN_MODULES.filter((m) => adminModules.has(m.key)).map((m) => m.label);
        setAdminSuccess(`Acceso a: ${names.join(', ')} agregado con exito`);
        setSavedModules(new Set(adminModules));
      } else {
        await api.delete(`/api/employees/${employeeId}/admin-access`);
        setAdminModules(new Set());
        setSavedModules(new Set());
        setAdminSuccess('Acceso de administrador revocado');
      }
      queryClient.invalidateQueries({ queryKey: ['employee-roles', employeeId] });
      setTimeout(() => setAdminSuccess(''), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingAdmin(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── Admin Access Section ─── */}
      {canManage && employeeRoles?.userId && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-gray-900">Convertir en administrador</h3>
              {hasAdminRole && (
                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">Activo</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Permite que este empleado acceda a la consola de administrador con los modulos que selecciones.
              Podra cambiar entre su vista de empleado y la de administrador sin cerrar sesion.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ADMIN_MODULES.map((mod) => {
                const isOn = adminModules.has(mod.key);
                return (
                  <label
                    key={mod.key}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                      isOn ? 'bg-teal-50 border-teal-200' : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${isOn ? 'text-teal-800' : 'text-gray-700'}`}>{mod.label}</p>
                      <p className="text-[11px] text-gray-400">{mod.desc}</p>
                    </div>
                    <div className="relative flex-shrink-0 ml-3">
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={() => toggleModule(mod.key)}
                        className="sr-only peer"
                      />
                      <div className={`w-10 h-5.5 rounded-full transition-colors ${isOn ? 'bg-[#008080]' : 'bg-gray-200'}`} style={{ height: 22 }} />
                      <div className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0.5'}`} style={{ width: 18, height: 18 }} />
                    </div>
                  </label>
                );
              })}
            </div>

            {adminSuccess && (
              <div className="mt-4 flex items-center gap-2 text-sm text-[#008080] bg-teal-50 border border-teal-100 rounded-xl px-4 py-2.5">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {adminSuccess}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              {hasChanges && adminModules.size > 0 && (
                <button
                  onClick={() => saveAdminAccess(true)}
                  disabled={savingAdmin}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: '#008080' }}
                >
                  {savingAdmin ? 'Guardando...' : hasAdminRole ? 'Actualizar acceso' : 'Habilitar acceso'}
                </button>
              )}
              {hasAdminRole && !hasChanges && (
                <p className="text-xs text-gray-400 mt-1">Sin cambios pendientes</p>
              )}
              {hasAdminRole && (
                <button
                  onClick={() => saveAdminAccess(false)}
                  disabled={savingAdmin}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  Quitar acceso de administrador
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ausencias moved to staff page "Asistencias" tab */}

      {/* Roles section hidden — V2 in super admin */}
      {false && (
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

    </div>
  );
}
