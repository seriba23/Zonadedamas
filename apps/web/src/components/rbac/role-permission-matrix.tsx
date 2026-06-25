// 'use client': componente de navegador con checkboxes interactivos y estado.
'use client';

// useState: estado de permisos marcados, módulos expandidos y si hay cambios sin guardar.
// useEffect: sincroniza el estado local con los permisos del rol al cargarlos.
import { useState, useEffect } from 'react';
// useQuery: para cargar la lista de todos los permisos y los del rol.
// useMutation: para guardar los cambios de permisos al backend.
// useQueryClient: para invalidar caché después de guardar.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// api: cliente HTTP del proyecto.
import { api } from '@/lib/api';

// Permission: un permiso del sistema (p.ej. appointments.create).
// module: módulo al que pertenece (p.ej. "appointments", "clients").
// action: acción del permiso (p.ej. "create", "read", "delete").
// name: clave técnica combinada "module.action" (p.ej. "appointments.create").
interface Permission {
  id: string;
  name: string;
  description?: string;
  module: string;
  action: string;
}

// RolePermission: relación entre un rol y un permiso (solo el id del permiso).
interface RolePermission {
  permissionId: string;
}

// RolePermissionMatrixProps: props del componente.
// roleId: id del rol cuyos permisos se editan.
// roleName: nombre del rol para mostrar en el encabezado.
// isSystemRole: si es true, los checkboxes son de solo lectura (no se pueden editar).
// onSave?: callback opcional que el padre ejecuta después de guardar cambios.
interface RolePermissionMatrixProps {
  roleId: string;
  roleName: string;
  isSystemRole?: boolean;
  onSave?: () => void;
}

// MODULE_LABELS: mapa de clave técnica a nombre en español del módulo.
// Record<string, string>: objeto donde cada clave y valor son strings.
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

// ACTION_LABELS: mapa de clave técnica de acción a texto en español.
const ACTION_LABELS: Record<string, string> = {
  read: 'Ver',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
  manage: 'Administrar',
  cancel: 'Cancelar',
  complete: 'Completar',
};

// RolePermissionMatrix: matriz de permisos para un rol.
// Muestra los permisos agrupados por módulo. Cada módulo se puede expandir/colapsar.
// Tiene un checkbox a nivel de módulo (marcar todos) y uno por cada permiso individual.
// isSystemRole=false: los roles del sistema no se pueden editar.
export function RolePermissionMatrix({
  roleId,
  roleName,
  isSystemRole = false,
  onSave,
}: RolePermissionMatrixProps) {
  // queryClient: para invalidar la caché de permisos del rol después de guardar.
  const queryClient = useQueryClient();

  // checkedPermissions: Set con los ids de permisos actualmente marcados.
  // Set<string>: estructura de datos donde cada valor es único (no hay duplicados).
  // Usar Set en lugar de array permite verificar .has(id) en O(1) en vez de O(n).
  const [checkedPermissions, setCheckedPermissions] = useState<Set<string>>(
    new Set(),
  );

  // expandedModules: Set con los módulos cuya lista de permisos está expandida.
  // Un módulo está en el Set → está expandido; no está → está colapsado.
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(),
  );

  // hasChanges: true si el usuario modificó algún permiso desde que se cargaron los datos.
  // Controla si el botón "Guardar cambios" está visible.
  const [hasChanges, setHasChanges] = useState(false);

  // Carga todos los permisos disponibles del sistema (catálogo completo).
  // Fetch all permissions
  const { data: permissionsData, isLoading: loadingPermissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.get<{ data: Permission[] }>('/api/permissions'),
  });

  // Carga los permisos actuales del rol específico.
  // enabled: !!roleId: solo ejecuta la query si roleId tiene valor (no es vacío/undefined).
  // Fetch role's current permissions
  const { data: rolePermissionsData, isLoading: loadingRolePerms } = useQuery({
    queryKey: ['role-permissions', roleId],
    queryFn: () =>
      api.get<{ data: RolePermission[] }>(
        `/api/roles/${roleId}/permissions`,
      ),
    enabled: !!roleId,
  });

  // useEffect: cuando llegan los permisos del rol, inicializa checkedPermissions con ellos.
  // Dependencia [rolePermissionsData]: se ejecuta cada vez que los datos del rol cambian.
  // .map((rp) => rp.permissionId): extrae el array de ids.
  // new Set(...): convierte el array a Set para búsqueda eficiente.
  // setHasChanges(false): no hay cambios sin guardar al cargar datos frescos.
  useEffect(() => {
    if (rolePermissionsData?.data) {
      const permIds = new Set(
        rolePermissionsData.data.map((rp) => rp.permissionId),
      );
      setCheckedPermissions(permIds);
      setHasChanges(false);
    }
  }, [rolePermissionsData]);

  // saveMutation: envía los cambios al backend (PUT reemplaza todos los permisos del rol).
  // Array.from(checkedPermissions): convierte el Set a array para enviarlo como JSON.
  // onSuccess: invalida el caché del rol, marca sin cambios y llama al callback del padre.
  // onSave?.(): llamada condicional con optional chaining — solo si onSave fue pasado como prop.
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

  // grouped: objeto que agrupa los permisos por módulo.
  // El backend puede devolver los permisos como array plano O como objeto agrupado.
  // Se manejan ambos formatos:
  //   - Array plano: se agrupa con .reduce() → { "appointments": [...], "clients": [...] }
  //   - Objeto agrupado: se usa directamente.
  // API returns permissions already grouped by module: { data: { module: Permission[] } }
  // Or as a flat array — handle both formats
  const rawPerms = permissionsData?.data;
  let grouped: Record<string, Permission[]> = {};
  if (Array.isArray(rawPerms)) {
    // .reduce(): acumula los permisos en el objeto grouped por su módulo.
    // acc: acumulador (el objeto en construcción). perm: permiso actual.
    // if (!acc[perm.module]): si el módulo aún no existe, lo inicializa como array vacío.
    // .push(perm): agrega el permiso al array de su módulo.
    grouped = rawPerms.reduce<Record<string, Permission[]>>(
      (acc, perm) => {
        if (!acc[perm.module]) acc[perm.module] = [];
        acc[perm.module].push(perm);
        return acc;
      },
      {},
    );
  } else if (rawPerms && typeof rawPerms === 'object') {
    // Si ya viene agrupado del backend, lo usamos directamente.
    grouped = rawPerms as Record<string, Permission[]>;
  }

  // permissions: array plano con todos los permisos (usado si se necesita la lista completa).
  // Object.values(grouped): obtiene los arrays de permisos de cada módulo.
  // .flat(): convierte el array de arrays en un array único.
  const permissions = Object.values(grouped).flat();

  // togglePermission: marca o desmarca un permiso individual.
  // Si isSystemRole: no hace nada (solo lectura).
  // const next = new Set(prev): crea una copia del Set (no mutamos el estado directamente).
  // next.has(permId): true si el permiso ya estaba marcado.
  // next.delete / next.add: toggling del permiso.
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

  // toggleModule: marca o desmarca TODOS los permisos de un módulo de una vez.
  // allChecked: true si todos los permisos del módulo ya están marcados.
  // .every((p) => ...): devuelve true solo si todos los elementos cumplen la condición.
  // Si allChecked: al hacer click, desmarca todos (toggle off).
  // Si no allChecked: al hacer click, marca todos (toggle on).
  // perms.forEach((p) => ...): itera cada permiso del módulo para marcarlo/desmarcarlo.
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

  // toggleModuleExpand: abre o cierra la lista de permisos de un módulo.
  // Si el módulo ya está en expandedModules → lo elimina (colapsa).
  // Si no está → lo agrega (expande).
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

  // isLoading: true si cualquiera de las dos queries está cargando.
  // || (OR lógico): basta con que una esté cargando para mostrar el esqueleto.
  const isLoading = loadingPermissions || loadingRolePerms;

  // Mientras cargan los datos: mostrar 5 bloques animados (skeleton loader).
  // Array.from({ length: 5 }): crea un array de 5 elementos undefined.
  // .map((_, i)): _ = elemento (no se usa), i = índice (se usa como key).
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // ── JSX: encabezado + lista de módulos con permisos ──────────────────────
  return (
    <div>
      {/* Encabezado: nombre del rol + contador de permisos asignados.
          Botón "Guardar cambios" aparece solo si !isSystemRole && hasChanges. */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{roleName}</h2>
          <p className="text-sm text-gray-500">
            {/* Ternario: si es rol de sistema, mensaje fijo. Si no, muestra el conteo.
                checkedPermissions.size: número de elementos en el Set.
                !== 1: si no es exactamente 1, agrega la 's' de plural. */}
            {isSystemRole
              ? 'Rol del sistema — no editable'
              : `${checkedPermissions.size} permiso${checkedPermissions.size !== 1 ? 's' : ''} asignado${checkedPermissions.size !== 1 ? 's' : ''}`}
          </p>
        </div>
        {/* Botón "Guardar cambios" en el header (duplicado al pie para comodidad). */}
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

      {/* Lista de módulos: Object.entries(grouped) = [[módulo, perms[]], ...].
          Cada entrada es una tarjeta colapsable con checkboxes. */}
      <div className="space-y-2">
        {Object.entries(grouped).map(([module, perms]) => {
          // allChecked: true si TODOS los permisos del módulo están marcados.
          // .every(): devuelve true solo si la condición se cumple para TODOS los elementos.
          const allChecked = perms.every((p) => checkedPermissions.has(p.id));

          // someChecked: true si AL MENOS UN permiso del módulo está marcado.
          // .some(): devuelve true si la condición se cumple para ALGÚN elemento.
          // Se usa para el estado "indeterminate" del checkbox del módulo.
          const someChecked = perms.some((p) => checkedPermissions.has(p.id));

          // isExpanded: true si el módulo está en el Set de expandidos.
          const isExpanded = expandedModules.has(module);

          return (
            // key={module}: clave única por módulo para la lista React.
            <div
              key={module}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Encabezado del módulo: click lo expande/colapsa.
                  Tiene: checkbox de módulo + nombre + contador N/total + flecha. */}
              {/* Module header */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleModuleExpand(module)}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox de módulo: solo para roles no del sistema.
                      ref callback: establece el estado indeterminate del checkbox nativo.
                      el.indeterminate = someChecked && !allChecked:
                        - true: guión en el checkbox (algunos pero no todos marcados).
                        - false: normal (vacío o lleno).
                      onClick={(e) => e.stopPropagation(): evita que el click en el checkbox
                        también dispare el onClick del div padre (que expande/colapsa). */}
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
                  {/* Nombre del módulo en español, con fallback al nombre técnico. */}
                  <span className="font-medium text-gray-900">
                    {MODULE_LABELS[module] || module}
                  </span>
                  {/* Contador "marcados/total" para este módulo. */}
                  <span className="text-xs text-gray-400">
                    {perms.filter((p) => checkedPermissions.has(p.id)).length}/
                    {perms.length}
                  </span>
                </div>
                {/* Flecha: rotate-180 cuando está expandido (CSS transition). */}
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

              {/* Lista de permisos individuales: solo visible cuando isExpanded = true.
                  isExpanded && (...): renderizado condicional. */}
              {/* Permissions list */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {/* Cada permiso es un <label> que contiene su checkbox.
                      Usar <label> permite que el click en el texto también marque el checkbox. */}
                  {perms.map((perm) => (
                    <label
                      key={perm.id}
                      className={`flex items-center gap-3 px-6 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 ${
                        isSystemRole ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      {/* Checkbox individual del permiso.
                          checked={checkedPermissions.has(perm.id)}: marcado si el id está en el Set.
                          disabled={isSystemRole}: deshabilitado para roles del sistema. */}
                      <input
                        type="checkbox"
                        checked={checkedPermissions.has(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        disabled={isSystemRole}
                        className="w-4 h-4 text-primary-600 rounded border-gray-300 disabled:opacity-60"
                      />
                      <div className="flex-1">
                        {/* Acción en español, con fallback a la clave técnica. */}
                        <p className="text-sm text-gray-700">
                          {ACTION_LABELS[perm.action] || perm.action}
                        </p>
                        {/* Descripción opcional del permiso. */}
                        {perm.description && (
                          <p className="text-xs text-gray-400">
                            {perm.description}
                          </p>
                        )}
                      </div>
                      {/* Nombre técnico del permiso (p.ej. "appointments.create").
                          font-mono: fuente monoespaciada para código/técnico. */}
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

      {/* Botón "Guardar cambios" al pie de la lista (duplicado del del header).
          Solo visible si hay cambios sin guardar y el rol es editable. */}
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
