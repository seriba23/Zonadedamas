// ============================================================
// ARCHIVO: employee-services-editor.tsx
// ¿QUÉ HACE ESTE COMPONENTE?
//   Editor de servicios que ofrece un empleado. Muestra una tabla
//   con todos los servicios del negocio agrupados por categoría.
//   El usuario puede:
//     - Seleccionar/deseleccionar qué servicios ofrece el empleado.
//     - Asignar un precio personalizado (distinto al base del servicio).
//     - Asignar una comisión del empleado por ese servicio.
//     - Ver la ganancia neta del negocio (precio − comisión).
//   Muestra totales en la parte inferior y un botón para guardar.
// ¿QUÉ RECIBE? (props)
//   - employeeId: ID del empleado cuyos servicios se gestionan.
// ============================================================

'use client';
// Necesario para usar hooks y eventos del usuario.

import { useState, useMemo, useCallback } from 'react';
// useState: guarda el mapa de servicios seleccionados con sus configs.
// useMemo: calcula valores derivados (grupos, hasChanges) sin recalcular
//   en cada render si sus dependencias no cambiaron.
// useCallback: memoriza funciones para que no se recreen en cada render.
//   Útil cuando se pasan como prop a componentes hijos o cuando se usan
//   como dependencias de useMemo/useEffect.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// useQuery: carga los servicios y los servicios actuales del empleado.
// useMutation: guarda los cambios en el servidor.
// useQueryClient: invalida caché para refrescar datos.

import { api } from '@/lib/api';
// Módulo propio de peticiones HTTP.

// ─── TIPOS ──────────────────────────────────────────────────

interface Service {
  // Un servicio del catálogo del negocio.
  id: string;
  name: string;
  category?: string;     // categoría principal (puede no existir)
  subcategory?: string;  // subcategoría (usada como agrupador principal en este editor)
  durationMinutes: number;
  price: number;         // precio base configurado en el servicio
}

interface EmployeeServiceEntry {
  // Relación empleado-servicio tal como la devuelve el servidor.
  employeeId: string;
  serviceId: string;
  customPrice: number | null;   // null = usa el precio base del servicio
  commission: number | null;    // null = sin comisión configurada
  service: Service;             // datos del servicio embebidos
}

interface ServiceConfig {
  // Configuración local (en la UI) de un servicio para este empleado.
  serviceId: string;
  commission: number | null;
  customPrice: number | null;
}

interface EmployeeServicesEditorProps {
  employeeId: string;
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────
export function EmployeeServicesEditor({ employeeId }: EmployeeServicesEditorProps) {
  const queryClient = useQueryClient();

  // Estado principal: un Map (mapa) que asocia cada serviceId con
  // su configuración (precio personalizado y comisión).
  // Map<K, V> = estructura de datos que mapea claves K a valores V.
  // Es más eficiente que un objeto para inserciones y búsquedas frecuentes.
  // Vacío al inicio (se llena cuando cargan los datos).
  const [selectedMap, setSelectedMap] = useState<Map<string, ServiceConfig>>(new Map());

  // Estado: bandera para saber si ya inicializamos el mapa con los datos
  // del servidor. Evita reinicializar cada vez que se re-renderiza.
  const [initialized, setInitialized] = useState(false);

  // ─── QUERY: todos los servicios del negocio ──────────────
  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.get<{ data: Service[] }>('/api/services'),
  });

  // ─── QUERY: servicios actuales del empleado ──────────────
  const { data: employeeServicesData, isLoading: loadingEmployee } = useQuery({
    queryKey: ['employee-services', employeeId],
    queryFn: () =>
      api.get<{ data: EmployeeServiceEntry[] }>(`/api/employees/${employeeId}/services`),
  });

  // Extraemos los arrays (o usamos [] si aún no cargaron).
  const allServices = servicesData?.data || [];
  const currentEntries = employeeServicesData?.data || [];

  // Initialize from current data on first load
  // Este bloque se ejecuta durante el render (no en un hook).
  // Se ejecuta solo cuando todas las queries terminaron (!loadingEmployee &&
  // !loadingServices) y aún no hemos inicializado (!initialized).
  // Es una alternativa a useEffect para este caso particular.
  if (!initialized && !loadingEmployee && !loadingServices) {
    const map = new Map<string, ServiceConfig>();
    // Recorremos las entradas actuales del empleado y las añadimos al Map.
    for (const entry of currentEntries) {
      map.set(entry.serviceId, {
        serviceId: entry.serviceId,
        // "entry.commission != null" usa != (no !==) para verificar que
        // NO es null NI undefined. Si tiene valor, lo convertimos a número.
        commission: entry.commission != null ? Number(entry.commission) : null,
        customPrice: entry.customPrice != null ? Number(entry.customPrice) : null,
      });
    }
    setSelectedMap(map);
    setInitialized(true);
  }

  // Group services by category. Al crear un servicio en /services la
  // profesion se guarda en subcategory (no en category), asi que ese
  // campo es la fuente principal.
  // useMemo: recalcula solo cuando allServices cambia.
  const grouped = useMemo(() => {
    // Creamos un objeto con categorías como claves y arrays de servicios como valores.
    const groups: Record<string, Service[]> = {};
    for (const svc of allServices) {
      // Usamos subcategory como agrupador principal; si no existe, usamos
      // category; si tampoco existe, agrupamos en 'Sin categoria'.
      const cat = svc.subcategory || svc.category || 'Sin categoria';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(svc);
    }
    // Convertimos el objeto a array de pares [categoria, servicios[]]
    // y los ordenamos alfabéticamente, poniendo "Sin categoria" al final.
    return Object.entries(groups).sort(([a], [b]) => {
      // [a] y [b] son los nombres de categoría (las claves del par).
      if (a === 'Sin categoria') return 1;   // manda a al final
      if (b === 'Sin categoria') return -1;  // b al principio si tiene 'Sin categoria'
      return a.localeCompare(b);             // orden alfabético normal
    });
  }, [allServices]);
  // La coma y [allServices] al final son las "dependencias" de useMemo.
  // Solo recalcula si allServices cambia.

  // toggleService: activa o desactiva un servicio en el mapa.
  // useCallback memoriza la función entre renders para no recrearla.
  // Su array de dependencias [] indica que nunca cambia (no depende
  // de ningún valor del componente).
  const toggleService = useCallback((serviceId: string) => {
    setSelectedMap((prev) => {
      // Creamos una copia del Map anterior para no mutarlo directamente.
      const next = new Map(prev);
      if (next.has(serviceId)) {
        // Si ya estaba en el mapa, lo removemos (deseleccionar).
        next.delete(serviceId);
      } else {
        // Si no estaba, lo añadimos con configuración vacía.
        next.set(serviceId, { serviceId, commission: null, customPrice: null });
      }
      return next;
    });
  }, []);

  // updateConfig: actualiza el precio personalizado o la comisión de un servicio.
  // "field" puede ser 'commission' o 'customPrice'.
  // "value" es el string del input number (puede ser '' si está vacío).
  const updateConfig = useCallback((serviceId: string, field: 'commission' | 'customPrice', value: string) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(serviceId);
      // Si el servicio no está en el mapa, no hacemos nada.
      if (!existing) return prev;
      // Si el input está vacío (''), lo guardamos como null.
      // Si tiene valor, lo parseamos a número decimal.
      const numValue = value === '' ? null : parseFloat(value);
      // Actualizamos solo el campo especificado con computed property [field].
      next.set(serviceId, { ...existing, [field]: numValue });
      return next;
    });
  }, []);

  // selectAll: añade todos los servicios al mapa (con config vacía).
  function selectAll() {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      for (const svc of allServices) {
        // Solo añade los que no estaban ya (no sobreescribe configs existentes).
        if (!next.has(svc.id)) {
          next.set(svc.id, { serviceId: svc.id, commission: null, customPrice: null });
        }
      }
      return next;
    });
  }

  // deselectAll: limpia el mapa por completo (ningún servicio seleccionado).
  function deselectAll() {
    setSelectedMap(new Map());
  }

  // ─── MUTATION: guardar servicios ─────────────────────────
  const saveMutation = useMutation({
    mutationFn: (services: ServiceConfig[]) =>
      // Envía el array de configuraciones al servidor.
      api.put<{ data: EmployeeServiceEntry[] }>(`/api/employees/${employeeId}/services`, { services }),
    onSuccess: (response) => {
      // Re-sync local state from server response to avoid stale comparisons
      // Re-sincronizamos el mapa con los datos que devolvió el servidor.
      // Esto asegura que los valores numéricos estén en el formato correcto.
      const map = new Map<string, ServiceConfig>();
      for (const entry of response.data) {
        map.set(entry.serviceId, {
          serviceId: entry.serviceId,
          commission: entry.commission != null ? Number(entry.commission) : null,
          customPrice: entry.customPrice != null ? Number(entry.customPrice) : null,
        });
      }
      setSelectedMap(map);
      queryClient.invalidateQueries({ queryKey: ['employee-services', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  // hasChanges: detecta si la configuración en la UI difiere de la guardada en DB.
  // useMemo recalcula solo cuando selectedMap o currentEntries cambian.
  const hasChanges = useMemo(() => {
    // Construimos un Map temporal con los datos actuales del servidor para comparar.
    const currentMap = new Map(currentEntries.map((e) => [e.serviceId, e]));
    // Primero comparamos el número de servicios seleccionados.
    if (selectedMap.size !== currentMap.size) return true;
    // Luego comparamos cada servicio individualmente.
    for (const [id, config] of selectedMap) {
      // "for...of" recorre las entradas del Map ([key, value]).
      const current = currentMap.get(id);
      // Si en la UI hay un servicio que no está en DB, hay cambio.
      if (!current) return true;
      // Convertimos los valores del servidor a números para comparar con exactitud.
      const curCommission = current.commission != null ? Number(current.commission) : null;
      const curCustomPrice = current.customPrice != null ? Number(current.customPrice) : null;
      // "?? null" convierte undefined a null para la comparación.
      if ((config.commission ?? null) !== curCommission) return true;
      if ((config.customPrice ?? null) !== curCustomPrice) return true;
    }
    return false;
  }, [selectedMap, currentEntries]);

  // Combinamos los estados de carga de las dos queries.
  const isLoading = loadingServices || loadingEmployee;

  // ─── Estado de carga ─────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {/* Array.from({ length: 4 }) crea un array de 4 elementos.
            "_" es la variable ignorada (el valor es undefined), "i" es el índice. */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-100 rounded" />
        ))}
      </div>
    );
  }

  // Si no hay servicios configurados en el negocio, mostramos un mensaje.
  if (allServices.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">
        No hay servicios configurados. Crea servicios primero en la seccion de Servicios.
      </p>
    );
  }

  // ─── handleSave ──────────────────────────────────────────
  function handleSave() {
    // Convertimos el Map a un array con solo los campos necesarios.
    const services = Array.from(selectedMap.values()).map((config) => ({
      serviceId: config.serviceId,
      // Spread condicional: si commission tiene valor, lo incluimos;
      // si es null, no lo incluimos en el objeto enviado al servidor.
      // "...(condición ? objeto : {})" es un patrón común en JS.
      ...(config.commission != null ? { commission: config.commission } : {}),
      ...(config.customPrice != null ? { customPrice: config.customPrice } : {}),
    }));
    saveMutation.mutate(services as ServiceConfig[]);
  }

  // ─── Funciones de cálculo ────────────────────────────────

  // getEffectivePrice: precio real del servicio para este empleado.
  // Si tiene customPrice configurado, lo usa; si no, usa el precio base del servicio.
  // "config?.customPrice ?? svc.price" = si config existe y tiene customPrice,
  // lo usa; de lo contrario usa svc.price.
  function getEffectivePrice(svc: Service, config: ServiceConfig | undefined) {
    return Number(config?.customPrice ?? svc.price);
  }

  // getBusinessProfit: ganancia neta del negocio = precio - comisión del empleado.
  // Si el empleado no tiene comisión configurada, devuelve null (no calculable).
  function getBusinessProfit(svc: Service, config: ServiceConfig | undefined) {
    if (!config || config.commission == null) return null;
    const price = getEffectivePrice(svc, config);
    return price - Number(config.commission);
  }

  // ─── JSX ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header: contador de seleccionados + botones de acción masiva */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {/* Ternario para plural: "seleccionado" vs "seleccionados". */}
          {selectedMap.size} de {allServices.length} seleccionado{selectedMap.size !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            Seleccionar todo
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={deselectAll}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium"
          >
            Deseleccionar todo
          </button>
        </div>
      </div>

      {/* Services table grouped by category */}
      {/* Contenedor con altura máxima y scroll vertical para listas largas. */}
      <div className="max-h-[500px] overflow-y-auto">
        {/* grouped es el array [categoria, servicios[]] de nuestro useMemo.
            .map() genera un bloque de tabla por cada categoría. */}
        {grouped.map(([category, services]) => (
          <div key={category} className="mb-4">
            {/* Título de la categoría en mayúsculas pequeñas */}
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {category}
            </h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs">
                    <th className="w-8 px-2 py-2"></th>
                    <th className="text-left px-2 py-2 font-medium">Servicio</th>
                    <th className="text-right px-2 py-2 font-medium w-20">Base</th>
                    <th className="text-right px-2 py-2 font-medium w-28">Precio cliente</th>
                    <th className="text-right px-2 py-2 font-medium w-28">Comision</th>
                    <th className="text-right px-2 py-2 font-medium w-24">Ganancia</th>
                  </tr>
                </thead>
                <tbody>
                  {/* .map() genera una fila (<tr>) por cada servicio de la categoría.
                      "svc" = objeto Service { id, name, price, durationMinutes, ... } */}
                  {services.map((svc) => {
                    // ¿Está este servicio seleccionado para el empleado?
                    const isSelected = selectedMap.has(svc.id);
                    // Configuración actual de este servicio en el mapa
                    // (undefined si no está seleccionado).
                    const config = selectedMap.get(svc.id);
                    // Calculamos ganancia y precio efectivo para mostrar en la fila.
                    const profit = getBusinessProfit(svc, config);
                    const effectivePrice = getEffectivePrice(svc, config);

                    return (
                      <tr
                        key={svc.id}
                        // Fondo teal muy suave si el servicio está seleccionado.
                        className={`border-t border-gray-100 transition-colors ${
                          isSelected ? 'bg-primary-50/50' : ''
                        }`}
                      >
                        {/* Checkbox de selección */}
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}           // controlado por el mapa
                            onChange={() => toggleService(svc.id)}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                        </td>
                        {/* Nombre del servicio y duración */}
                        <td className="px-2 py-2">
                          {/* Texto más oscuro si está seleccionado, gris si no. */}
                          <span className={isSelected ? 'text-gray-900' : 'text-gray-400'}>
                            {svc.name}
                          </span>
                          <span className="text-xs text-gray-400 ml-1">
                            ({svc.durationMinutes}min)
                          </span>
                        </td>
                        {/* Precio base del servicio (referencia, no editable) */}
                        <td className="px-2 py-2 text-right text-gray-500 tabular-nums">
                          {/* "tabular-nums" asegura que los números se alineen
                              correctamente en columnas (usan fuente monoespaciada). */}
                          ${Number(svc.price).toFixed(2)}
                        </td>
                        {/* Input de precio personalizado para el cliente */}
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"  // permite decimales de 2 cifras
                            min="0"
                            disabled={!isSelected}
                            // Cuando no está seleccionado, el input se deshabilita.
                            // El placeholder muestra el precio base como referencia.
                            placeholder={Number(svc.price).toFixed(2)}
                            // "config?.customPrice ?? ''" = si config existe y tiene
                            // customPrice, lo muestra; si es null, muestra vacío ('').
                            value={config?.customPrice ?? ''}
                            onChange={(e) => updateConfig(svc.id, 'customPrice', e.target.value)}
                            className="w-24 text-right text-sm border border-gray-200 rounded px-2 py-1 tabular-nums
                              disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed
                              focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                          />
                        </td>
                        {/* Input de comisión del empleado */}
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={!isSelected}
                            placeholder="0.00"
                            value={config?.commission ?? ''}
                            onChange={(e) => updateConfig(svc.id, 'commission', e.target.value)}
                            className="w-24 text-right text-sm border border-gray-200 rounded px-2 py-1 tabular-nums
                              disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed
                              focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
                          />
                        </td>
                        {/* Celda de ganancia neta del negocio */}
                        <td className="px-2 py-2 text-right tabular-nums">
                          {/* Renderizado condicional con ternarios anidados:
                              1. Si está seleccionado Y hay ganancia calculada → muestra el valor.
                              2. Si está seleccionado pero no hay comisión → guiones.
                              3. Si no está seleccionado → guiones. */}
                          {isSelected && profit != null ? (
                            // Verde si la ganancia es positiva, rojo si es negativa.
                            <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                              ${profit.toFixed(2)}
                            </span>
                          ) : isSelected ? (
                            <span className="text-gray-300">--</span>
                          ) : (
                            <span className="text-gray-300">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Summary: totales de precios y comisiones */}
      {/* Solo visible si hay al menos un servicio seleccionado. */}
      {selectedMap.size > 0 && (
        <div className="flex gap-4 text-xs text-gray-500 border-t border-gray-100 pt-3">
          <span>
            Total precio:{' '}
            {/* {' '} es un espacio en JSX (los espacios en JSX entre
                elementos no siempre se preservan, por eso se pone explícito). */}
            <strong className="text-gray-700">
              {/* Calculamos la suma de precios efectivos de todos los servicios
                  seleccionados.
                  .filter(): solo los servicios cuyo id está en selectedMap.
                  .reduce(): acumula la suma. "sum" es el acumulador (empieza en 0),
                  "s" es cada servicio. */}
              ${allServices
                .filter((s) => selectedMap.has(s.id))
                .reduce((sum, s) => sum + getEffectivePrice(s, selectedMap.get(s.id)), 0)
                .toFixed(2)}
            </strong>
          </span>
          <span>
            Total comisiones:{' '}
            <strong className="text-gray-700">
              {/* Array.from(selectedMap.values()) convierte los valores del Map
                  a un array normal de ServiceConfig[].
                  .reduce() suma todas las comisiones. "c.commission ?? 0" usa 0
                  si la comisión es null (no configurada). */}
              ${Array.from(selectedMap.values())
                .reduce((sum, c) => sum + Number(c.commission ?? 0), 0)
                .toFixed(2)}
            </strong>
          </span>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={handleSave}
          // Deshabilitado si no hay cambios O si la mutación está en progreso.
          disabled={!hasChanges || saveMutation.isPending}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveMutation.isPending ? 'Guardando...' : 'Guardar servicios'}
        </button>
      </div>

      {/* Mensajes de resultado */}
      {saveMutation.isSuccess && (
        <p className="text-sm text-green-600 text-center">Servicios actualizados correctamente</p>
      )}
      {saveMutation.isError && (
        <p className="text-sm text-red-600 text-center">Error al guardar los servicios</p>
      )}
    </div>
  );
}
