// ============================================================
// ARCHIVO: employee-permissions.tsx
// ¿QUÉ HACE ESTE COMPONENTE?
//   Muestra y gestiona los permisos de administrador de un empleado.
//   Permite activar o desactivar el "acceso de administrador" para
//   módulos específicos (Calendario, Clientes, Servicios, etc.).
//   El empleado con acceso puede cambiar entre su vista de empleado
//   y la de administrador sin cerrar sesión.
// ¿QUÉ RECIBE? (props)
//   - employeeId: ID del empleado cuyos permisos se gestionan.
//   - canManage: si el usuario actual puede modificar permisos.
// NOTA: Este archivo tiene errores de TypeScript preexistentes
//   (en la sección de roles oculta con {false && ...}). NO se
//   corrigen aquí; solo se documentan.
// ============================================================

'use client';
// Necesario porque usa useState, useQuery, etc. (hooks del cliente).

import { useState } from 'react';
// useState: guarda valores que cambian y re-dibujan el componente.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// useQuery: hace peticiones GET al servidor y cachea los resultados.
// useMutation: hace peticiones POST/PUT/DELETE que modifican datos.
// useQueryClient: permite invalidar (refrescar) caché de otras queries.

import { api } from '@/lib/api';
// Módulo propio que encapsula fetch() con autenticación JWT y manejo
// de errores. "@/" es un alias que apunta a "src/".

import { EmployeeTimeOffEditor } from '@/components/staff/employee-time-off-editor';
// Subcomponente para gestionar ausencias. Se importa aunque la sección
// de ausencias está comentada/movida a otra pantalla.

// ─── TIPOS ──────────────────────────────────────────────────

interface Permission {
  // Un permiso individual del sistema. Formato: "module.action".
  id: string;
  module: string;       // ej: "appointments", "clients", "services"
  action: string;       // ej: "read", "create", "update", "delete"
  description?: string | null;
}

interface EmployeeRole {
  // Un rol asignado a un empleado. Contiene sus permisos.
  userRoleId: string;   // ID de la relación usuario-rol (para eliminarla)
  roleId: string;       // ID del rol en sí
  roleName: string;     // nombre legible, ej: "Empleado", "Admin"
  roleSlug: string;     // slug técnico, ej: "employee", "admin"
  isSystem: boolean;    // true = rol del sistema, no se puede eliminar
  permissions: Permission[];
}

interface EmployeeRolesData {
  // Respuesta del endpoint /api/employees/:id/roles
  userId: string | null;     // puede ser null si el empleado no tiene usuario
  roles: EmployeeRole[];     // lista de roles asignados
}

interface Role {
  // Un rol disponible en el sistema (para el selector de "agregar rol")
  id: string;
  name: string;
  slug: string;
  description?: string;
  isSystem: boolean;
}

// ─── CONSTANTE: módulos disponibles para el acceso admin ────
// Este array define qué módulos del panel de admin se pueden
// habilitar para el empleado. Cada entrada tiene:
//   key: nombre técnico que se envía al backend
//   label: texto legible en la UI
//   desc: descripción corta para el usuario
const ADMIN_MODULES = [
  { key: 'appointments', label: 'Calendario', desc: 'Ver y gestionar citas' },
  { key: 'reminders', label: 'Recordatorios', desc: 'Enviar recordatorios de citas por WhatsApp' },
  { key: 'clients', label: 'Clientes', desc: 'Gestionar directorio de clientes' },
  { key: 'services', label: 'Servicios', desc: 'Configurar servicios y precios' },
  { key: 'payments', label: 'Punto de Venta', desc: 'Cobrar citas y vender productos' },
  { key: 'employees', label: 'Personal', desc: 'Gestionar empleados y horarios' },
  { key: 'reports', label: 'Reportes', desc: 'Ver estadisticas e ingresos' },
  { key: 'inventory', label: 'Inventario', desc: 'Productos y proveedores' },
  { key: 'rewards', label: 'Cupones', desc: 'Cupones, descuentos, 2×1 y fidelidad' },
  { key: 'resources', label: 'Recursos', desc: 'Salas y equipamiento' },
  { key: 'locations', label: 'Sucursales', desc: 'Gestionar ubicaciones' },
];

// Tipo para la sección activa dentro de este componente.
// Solo puede ser 'roles' o 'ausencias'.
type PermissionsSection = 'roles' | 'ausencias';

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────
export function EmployeePermissions({
  employeeId,
  canManage,
}: {
  employeeId: string;
  canManage: boolean;
}) {
  // queryClient nos permite interactuar con la caché de React Query,
  // por ejemplo para invalidar (forzar refetch) datos después de mutaciones.
  const queryClient = useQueryClient();

  // Estado: qué sección está activa ('roles' o 'ausencias').
  const [activeSection, setActiveSection] = useState<PermissionsSection>('roles');

  // Estado: qué módulo de permisos está expandido en el acordeón.
  // null = ninguno expandido. string = el nombre del módulo expandido.
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  // Estado: ID del rol seleccionado en el <select> para agregar un rol.
  const [selectedRoleId, setSelectedRoleId] = useState('');

  // Estado: Set (conjunto) de módulos admin que el empleado tiene
  // activados en la interfaz (puede diferir de lo guardado en DB).
  // Set es como un array pero sin duplicados y con búsqueda O(1).
  const [adminModules, setAdminModules] = useState<Set<string>>(new Set());

  // Estado: Set de módulos guardados en DB (para detectar cambios sin guardar).
  const [savedModules, setSavedModules] = useState<Set<string>>(new Set());

  // Estado: true mientras se está enviando la petición de guardar acceso admin.
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Estado: mensaje de éxito temporal después de guardar (vacío = no mostrar).
  const [adminSuccess, setAdminSuccess] = useState('');

  // ─── QUERY: roles actuales del empleado ─────────────────
  // useQuery devuelve { data, isLoading, isError, ... }.
  // queryKey: identifica esta query en la caché. Si dos componentes
  //   usan la misma key, comparten los datos (sin hacer dos peticiones).
  // queryFn: función que hace la petición HTTP.
  // enabled: si es false, la query no se ejecuta (aquí siempre se ejecuta
  //   porque !!employeeId es true cuando hay un ID).
  const { data: rolesData, isLoading: loadingRoles } = useQuery({
    queryKey: ['employee-roles', employeeId],
    queryFn: () =>
      api.get<{ data: EmployeeRolesData }>(
        `/api/employees/${employeeId}/roles`,
      ),
    enabled: !!employeeId,
    // "!!" convierte el valor a booleano: si employeeId es string no vacío,
    // !!employeeId = true. Si es '' o undefined, es false.
  });

  // ─── QUERY: todos los roles del sistema ─────────────────
  // Para mostrar el selector de "agregar rol". Solo se ejecuta si
  // canManage es true (si el usuario puede gestionar permisos).
  const { data: allRolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get<{ data: Role[] }>('/api/roles'),
    enabled: canManage,
  });

  // Extraemos .data de cada respuesta (o usamos [] si aún no llegó).
  const employeeRoles = rolesData?.data;
  // "?." es el operador de acceso seguro (optional chaining):
  // si rolesData es undefined, no falla con error, devuelve undefined.
  const allRoles = allRolesData?.data || [];
  // "|| []" = si allRolesData?.data es undefined, usa array vacío.

  // Filter out roles already assigned
  // Creamos un Set con los roleIds ya asignados para búsqueda rápida.
  const assignedRoleIds = new Set(
    employeeRoles?.roles.map((r) => r.roleId) || [],
    // .map() transforma el array de roles en un array de solo sus IDs.
    // Si employeeRoles?.roles es undefined, usa [].
  );
  // Filtramos los roles del sistema excluyendo los ya asignados.
  // !assignedRoleIds.has(r.id) = true si r.id NO está en el Set.
  const availableRoles = allRoles.filter((r) => !assignedRoleIds.has(r.id));

  // ─── MUTATION: asignar rol ───────────────────────────────
  // useMutation sirve para operaciones que modifican datos en el servidor.
  // mutationFn: la función que realiza la petición (recibe el argumento
  //   que se pasa a assignMutation.mutate(...)).
  // onSuccess: se ejecuta cuando la petición termina con éxito.
  const assignMutation = useMutation({
    mutationFn: (roleId: string) =>
      api.post('/api/user-roles', {
        userId: employeeRoles?.userId,
        roleId,
      }),
    onSuccess: () => {
      // Invalidar la caché de roles del empleado para que se recarguen.
      // React Query hará automáticamente un nuevo GET al servidor.
      queryClient.invalidateQueries({
        queryKey: ['employee-roles', employeeId],
      });
      // Limpiar el selector de roles.
      setSelectedRoleId('');
    },
  });

  // ─── MUTATION: quitar rol ────────────────────────────────
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
  // Primero aplanamos todos los permisos de todos los roles en un solo array.
  // .flatMap() es como .map() pero aplana un nivel: si el callback devuelve
  // un array, sus elementos se añaden directamente al resultado final.
  const allPermissions = (employeeRoles?.roles || []).flatMap((r) => r.permissions);

  // Eliminamos permisos duplicados usando un Map con el id como clave.
  // new Map(allPermissions.map((p) => [p.id, p])) crea un Map donde:
  //   - la clave es p.id (el ID del permiso)
  //   - el valor es p (el objeto permiso completo)
  // Como Map no permite claves duplicadas, si hay dos permisos con el
  // mismo id, el segundo sobreescribe al primero (deduplicación).
  // .values() obtiene solo los valores (los objetos permiso) del Map.
  // Array.from(...) convierte el iterador de values a un array normal.
  const uniquePermissions = Array.from(
    new Map(allPermissions.map((p) => [p.id, p])).values(),
  );

  // Agrupamos los permisos únicos por módulo.
  // .reduce() recorre el array y va construyendo un objeto "acumulador" (acc).
  // Empieza con {} y para cada permiso (perm):
  //   - si acc no tiene la clave perm.module, la crea con [].
  //   - luego añade el permiso a ese array.
  // Resultado: { "appointments": [perm1, perm2], "clients": [perm3], ... }
  const groupedPermissions = uniquePermissions.reduce(
    (acc, perm) => {
      if (!acc[perm.module]) acc[perm.module] = [];
      acc[perm.module].push(perm);
      return acc;
    },
    {} as Record<string, Permission[]>,
    // "Record<string, Permission[]>" = tipo de objeto cuyas claves son
    // strings y cuyos valores son arrays de Permission.
  );

  // Detect if employee has admin-like role (not staff/readonly)
  // .some() devuelve true si AL MENOS UN elemento del array cumple la condición.
  // Comprueba si algún rol del empleado es admin, manager, owner o Ayudante.
  const hasAdminRole = (employeeRoles?.roles || []).some(
    (r) => r.roleSlug === 'admin' || r.roleSlug === 'manager' || r.roleSlug === 'owner' || r.roleName === 'Ayudante',
  );

  // Busca si existe específicamente el rol "Ayudante" entre los roles asignados.
  // .find() devuelve el primer elemento que cumple la condición, o undefined.
  const helperRole = (employeeRoles?.roles || []).find((r) => r.roleName === 'Ayudante');

  // Initialize admin modules from existing helper role
  // NOTA DE TS: Aquí se usa useState como función de efecto secundario,
  // lo cual es un anti-patrón (debería ser useEffect). Los errores de
  // TypeScript en este bloque son preexistentes y no se corrigen.
  useState(() => {
    if (helperRole) {
      // Si el empleado ya tiene el rol Ayudante, inicializamos adminModules
      // con los módulos que ya tiene acceso (para que los toggles aparezcan
      // en el estado correcto al abrir el componente).
      const permKeys = new Set(
        helperRole.permissions.map((p) => `${p.module}.${p.action}`),
      );
      const mods = new Set<string>();
      for (const p of helperRole.permissions) {
        // 'appointments' (Calendario) se maneja aparte: comparte el permiso
        // appointments.read con Recordatorios. Lo activamos solo si hay un
        // permiso de ESCRITURA de citas (si no, es solo Recordatorios).
        if (p.module === 'appointments') continue;
        mods.add(p.module);
      }
      const hasApptWrite = ['create', 'update', 'cancel', 'reschedule', 'complete'].some(
        (a) => permKeys.has(`appointments.${a}`),
      );
      if (hasApptWrite) mods.add('appointments');          // Calendario
      if (permKeys.has('appointments.read')) mods.add('reminders'); // Recordatorios
      setAdminModules(mods);
      setSavedModules(mods);
    }
  });

  // ─── toggleModule ────────────────────────────────────────
  // Activa o desactiva un módulo en el Set de adminModules.
  // Recibe el nombre del módulo (ej: "appointments").
  function toggleModule(mod: string) {
    // Usamos la forma funcional de setAdminModules: en lugar de pasar
    // el nuevo valor directamente, pasamos una función que recibe el
    // valor anterior (prev) y devuelve el nuevo.
    // Esto es necesario cuando el nuevo estado depende del anterior.
    setAdminModules((prev) => {
      // Creamos una COPIA del Set anterior para no mutar el estado directamente.
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);  // si ya estaba, lo quitamos
      else next.add(mod);                    // si no estaba, lo añadimos
      return next;
    });
  }

  // Check if there are unsaved changes
  // Comparamos adminModules (estado actual de la UI) con savedModules
  // (lo que está guardado en DB). Si son distintos, hay cambios pendientes.
  const hasChanges = (() => {
    // IIFE (Immediately Invoked Function Expression): función que se ejecuta
    // inmediatamente. Permite usar return dentro de la expresión.
    if (adminModules.size !== savedModules.size) return true;
    // Recorremos cada módulo activo en la UI. Si alguno no está en savedModules,
    // hay un cambio (se añadió algo nuevo).
    for (const m of adminModules) if (!savedModules.has(m)) return true;
    return false;
  })();

  // ─── saveAdminAccess ─────────────────────────────────────
  // Guarda los cambios de acceso de administrador.
  // "enable": true = habilitar/actualizar acceso, false = quitar acceso.
  async function saveAdminAccess(enable: boolean) {
    if (!employeeRoles?.userId) return;
    // Si el empleado no tiene usuario vinculado, no se puede hacer nada.

    setSavingAdmin(true);    // mostrar estado de carga
    setAdminSuccess('');     // limpiar mensaje anterior
    try {
      if (enable && adminModules.size > 0) {
        // Enviar al backend los módulos que el empleado debe tener acceso.
        // Array.from(adminModules) convierte el Set a array (JSON lo necesita).
        await api.post(`/api/employees/${employeeId}/admin-access`, {
          modules: Array.from(adminModules),
        });
        // Construimos el mensaje de éxito con los nombres de los módulos.
        // .filter() selecciona solo los módulos de ADMIN_MODULES que están activos.
        // .map() extrae solo el label (nombre legible) de cada uno.
        // .join(', ') une el array en un string separado por comas.
        const names = ADMIN_MODULES.filter((m) => adminModules.has(m.key)).map((m) => m.label);
        setAdminSuccess(`Acceso a: ${names.join(', ')} agregado con exito`);
        // Sincronizamos savedModules con lo que acabamos de guardar.
        setSavedModules(new Set(adminModules));
      } else {
        // Si enable es false, eliminamos todo el acceso de administrador.
        await api.delete(`/api/employees/${employeeId}/admin-access`);
        setAdminModules(new Set());
        setSavedModules(new Set());
        setAdminSuccess('Acceso de administrador revocado');
      }
      // Forzamos el refetch de los roles del empleado para mostrar
      // el estado actualizado sin que el usuario recargue la página.
      queryClient.invalidateQueries({ queryKey: ['employee-roles', employeeId] });
      // Limpiamos el mensaje de éxito después de 5 segundos.
      setTimeout(() => setAdminSuccess(''), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      // "finally" se ejecuta siempre, haya o no error.
      setSavingAdmin(false);
    }
  }

  // ─── JSX ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ─── Admin Access Section ─── */}
      {/* Renderizado condicional con &&: solo muestra esta sección si
          canManage es true Y si el empleado tiene un userId vinculado. */}
      {canManage && employeeRoles?.userId && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-gray-900">Convertir en administrador</h3>
              {/* Muestra la insignia "Activo" solo si el empleado ya
                  tiene un rol de tipo admin (ternario implícito con &&). */}
              {hasAdminRole && (
                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">Activo</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Permite que este empleado acceda a la consola de administrador con los modulos que selecciones.
              Podra cambiar entre su vista de empleado y la de administrador sin cerrar sesion.
            </p>

            {/* Grid de módulos. Cada módulo se muestra como una "tarjeta"
                que actúa como un toggle switch (interruptor on/off). */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* .map() recorre ADMIN_MODULES y genera una tarjeta por cada módulo.
                  "mod" = { key, label, desc } de cada elemento del array. */}
              {ADMIN_MODULES.map((mod) => {
                // Comprobamos si este módulo está activado en el Set.
                const isOn = adminModules.has(mod.key);
                return (
                  // <label> como contenedor hace que el clic en cualquier
                  // parte de la tarjeta active el checkbox oculto dentro.
                  <label
                    key={mod.key}
                    // Estilo dinámico: fondo teal si está activo, blanco si no.
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                      isOn ? 'bg-teal-50 border-teal-200' : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${isOn ? 'text-teal-800' : 'text-gray-700'}`}>{mod.label}</p>
                      <p className="text-[11px] text-gray-400">{mod.desc}</p>
                    </div>
                    {/* Toggle switch personalizado con CSS.
                        El checkbox real está oculto ("sr-only" = solo para
                        lectores de pantalla). Los dos divs debajo simulan
                        el aspecto visual del interruptor. */}
                    <div className="relative flex-shrink-0 ml-3">
                      <input
                        type="checkbox"
                        checked={isOn}           // controlado: el valor viene del estado
                        onChange={() => toggleModule(mod.key)}  // al cambiar, llama toggleModule
                        className="sr-only peer" // "sr-only" = visually hidden pero accesible
                      />
                      {/* Pista del toggle (el fondo ovalado) */}
                      <div className={`w-10 h-5.5 rounded-full transition-colors ${isOn ? 'bg-[#008080]' : 'bg-gray-200'}`} style={{ height: 22 }} />
                      {/* Círculo blanco que se desliza según el estado.
                          "translate-x-5" lo mueve a la derecha (activado),
                          "translate-x-0.5" lo deja a la izquierda (desactivado). */}
                      <div className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0.5'}`} style={{ width: 18, height: 18 }} />
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Mensaje de éxito (solo visible si adminSuccess no está vacío).
                La condición && hace que se renderice solo cuando hay texto. */}
            {adminSuccess && (
              <div className="mt-4 flex items-center gap-2 text-sm text-[#008080] bg-teal-50 border border-teal-100 rounded-xl px-4 py-2.5">
                {/* Ícono de checkmark (palomita) SVG */}
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {adminSuccess}
              </div>
            )}

            {/* Botones de acción: Guardar / Actualizar / Quitar acceso */}
            <div className="flex gap-3 mt-4">
              {/* Botón "Habilitar/Actualizar acceso": solo visible si hay
                  cambios pendientes Y hay al menos un módulo seleccionado. */}
              {hasChanges && adminModules.size > 0 && (
                <button
                  onClick={() => saveAdminAccess(true)}
                  disabled={savingAdmin}
                  // "disabled" bloquea el botón mientras se guarda.
                  // "disabled:opacity-50" = clase Tailwind que reduce la opacidad
                  // cuando el botón está deshabilitado.
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: '#008080' }}
                >
                  {/* Operador ternario: muestra texto diferente según el estado.
                      Si savingAdmin es true → "Guardando..."
                      Si ya tiene rol admin → "Actualizar acceso"
                      Si no → "Habilitar acceso" */}
                  {savingAdmin ? 'Guardando...' : hasAdminRole ? 'Actualizar acceso' : 'Habilitar acceso'}
                </button>
              )}
              {/* Mensaje de "sin cambios" cuando ya tiene acceso y no hay ediciones */}
              {hasAdminRole && !hasChanges && (
                <p className="text-xs text-gray-400 mt-1">Sin cambios pendientes</p>
              )}
              {/* Botón "Quitar acceso": solo visible si el empleado ya tiene
                  un rol admin. Lo quita completamente del sistema. */}
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

      {/* Estado de carga / sin cuenta: cuando el empleado NO tiene usuario
          vinculado (ej. alta sin correo), la sección de "Convertir en
          administrador" se oculta; aquí mostramos un mensaje claro en vez de
          dejar la pestaña totalmente en blanco. */}
      {canManage && (
        loadingRoles ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !employeeRoles?.userId ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p className="text-gray-600 text-sm font-medium">
              Este empleado no tiene una cuenta de usuario vinculada.
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Para darle acceso a la consola o asignarle permisos, primero
              vincúlale un usuario (con su correo) desde la edición del empleado.
            </p>
          </div>
        ) : null
      )}

      {/* Ausencias moved to staff page "Asistencias" tab */}

      {/* Roles section hidden — V2 in super admin */}
      {/* La expresión {false && (...)} nunca se renderiza porque "false &&"
          siempre es false. Es una forma de comentar bloques de JSX
          manteniéndolos en el código para uso futuro.
          NOTA: el código dentro tiene errores de TS preexistentes
          (clases CSS como "btn-primary", "input-field" que no existen
          como clases Tailwind estándar, y referencias a variables que
          podrían causar problemas). Se documentan pero no se corrigen. */}
      {false && (
        <>
          {/* Fragment (<>...</>) permite agrupar múltiples elementos
              sin añadir un nodo HTML extra al DOM. */}
          {loadingRoles ? (
            // Esqueleto de carga: barras grises animadas mientras carga.
            <div className="space-y-3">
              {[1, 2].map((i) => (
                // .map() sobre un array de números para generar N esqueletos.
                // "key={i}" usa el número como identificador único.
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !employeeRoles?.userId ? (
            // Si el empleado no tiene userId, muestra mensaje informativo.
            // "!employeeRoles?.userId" = true si userId es null, undefined o falsy.
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
            // Si tiene userId, muestra los roles asignados y permisos.
            <>
              {/* Assigned Roles */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Roles asignados</h3>

                {employeeRoles.roles.length === 0 ? (
                  <p className="text-sm text-gray-400">No tiene roles asignados</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {employeeRoles.roles.map((role) => (
                      // Cada rol asignado se muestra como un "chip" (píldora).
                      <div
                        key={role.userRoleId}
                        className="inline-flex items-center gap-1.5 bg-primary-50 text-primary-700 px-3 py-1.5 rounded-full text-sm font-medium"
                      >
                        {role.roleName}
                        {/* Indica si es un rol del sistema (no eliminable). */}
                        {role.isSystem && (
                          <span className="text-xs text-primary-400">(sistema)</span>
                        )}
                        {/* Botón "X" para quitar el rol: solo si se puede
                            gestionar y NO es un rol del sistema. */}
                        {canManage && !role.isSystem && (
                          <button
                            onClick={() => removeMutation.mutate(role.userRoleId)}
                            // .mutate() dispara la mutación con el argumento dado.
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
                {/* Selector para agregar un rol que aún no tiene el empleado. */}
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
                        // Solo dispara la mutación si hay un rol seleccionado.
                        if (selectedRoleId) assignMutation.mutate(selectedRoleId);
                      }}
                      // El botón se deshabilita si no hay rol seleccionado
                      // O si la mutación está en progreso.
                      disabled={!selectedRoleId || assignMutation.isPending}
                      className="btn-primary text-sm"
                    >
                      {assignMutation.isPending ? 'Asignando...' : 'Agregar'}
                    </button>
                  </div>
                )}
              </div>

              {/* Permissions summary */}
              {/* Solo muestra el resumen si hay al menos un módulo con permisos.
                  Object.keys() devuelve un array con las claves del objeto. */}
              {Object.keys(groupedPermissions).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">Permisos efectivos</h3>
                  <div className="space-y-2">
                    {/* Object.entries() devuelve array de pares [clave, valor].
                        Aquí: [["appointments", [perm1, perm2]], ["clients", [perm3]], ...]
                        .sort(([a], [b]) => a.localeCompare(b)) ordena alfabéticamente
                        por el nombre del módulo (la clave). */}
                    {Object.entries(groupedPermissions)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([module, perms]) => (
                        // Cada módulo es un acordeón expandible/contraíble.
                        <div key={module} className="border border-gray-100 rounded-lg">
                          <button
                            type="button"
                            // Al hacer clic: si el módulo ya está expandido
                            // (expandedRole === module), lo cierra (null).
                            // Si no, lo abre (module).
                            onClick={() =>
                              setExpandedRole(expandedRole === module ? null : module)
                            }
                            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700 capitalize">
                                {module}
                              </span>
                              {/* Badge con la cantidad de permisos en este módulo. */}
                              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                {perms.length}
                              </span>
                            </div>
                            {/* Flecha que rota 180° cuando el acordeón está abierto. */}
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
                          {/* Contenido del acordeón: solo visible si este
                              módulo es el expandedRole activo. */}
                          {expandedRole === module && (
                            <div className="px-3 pb-3 space-y-1">
                              {/* .sort() ordena los permisos del módulo
                                  alfabéticamente por su "action". */}
                              {perms
                                .sort((a, b) => a.action.localeCompare(b.action))
                                .map((perm) => (
                                  <div
                                    key={perm.id}
                                    className="flex items-center gap-2 text-sm pl-2"
                                  >
                                    {/* Ícono de checkmark verde */}
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
                                    {/* La descripción solo se muestra si existe.
                                        perm.description && (...) = si es truthy, renderiza. */}
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
