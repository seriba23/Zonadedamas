// ============================================================
// ARCHIVO: employee-schedule-editor.tsx
// ¿QUÉ HACE ESTE COMPONENTE?
//   Editor del horario semanal de un empleado. Muestra los 7
//   días de la semana con toggles (on/off) y selectores de hora
//   de inicio y fin. Los días en que el negocio está cerrado
//   se muestran bloqueados. También tiene un botón para replicar
//   el horario del primer día activo a todos los demás.
// ¿QUÉ RECIBE? (props)
//   - employeeId: ID del empleado cuyo horario se edita.
// ============================================================

'use client';
// Necesario porque usa hooks (useState, useEffect) y eventos del usuario.

import { useState, useEffect } from 'react';
// useState: guarda el horario editable y si hay cambios pendientes.
// useEffect: sincroniza el estado local cuando llegan datos del servidor.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// useQuery: carga el horario actual del empleado y el horario del negocio.
// useMutation: guarda los cambios del horario en el servidor.
// useQueryClient: invalida caché para forzar refetch tras guardar.

import { api } from '@/lib/api';
// Módulo propio de HTTP con autenticación JWT.

import { useTenantTier } from '@/lib/hooks/use-tenant-tier';
// Hook personalizado que indica si el tenant (negocio) es "freelancer".
// Los freelancers no tienen "negocio" como tal, por lo que no tienen
// restricciones de días cerrados del negocio.

// ─── TIPOS ──────────────────────────────────────────────────

interface Schedule {
  // Horario de un día de la semana para un empleado.
  id?: string;           // ID en DB (puede no existir si es un default local)
  dayOfWeek: string;     // "MONDAY", "TUESDAY", etc.
  isWorking: boolean;    // si trabaja ese día
  startTime: string;     // "09:00" (HH:MM)
  endTime: string;       // "18:00" (HH:MM)
  effectiveFrom: string; // fecha desde la que aplica este horario (ISO date)
}

interface BusinessHour {
  // Horario de apertura del negocio para un día de la semana.
  dayOfWeek: string;
  isOpen: boolean;       // false = el negocio está cerrado ese día
}

interface EmployeeScheduleEditorProps {
  employeeId: string;
}

// ─── CONSTANTES ─────────────────────────────────────────────

// Mapeo de claves internas a nombres largos en español.
// Record<string, string> = objeto con claves y valores string.
const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

// Versión corta para mobile (poco espacio horizontal). En desktop
// (md:) se muestra el nombre completo.
const DAY_LABELS_SHORT: Record<string, string> = {
  MONDAY: 'Lun',
  TUESDAY: 'Mar',
  WEDNESDAY: 'Mié',
  THURSDAY: 'Jue',
  FRIDAY: 'Vie',
  SATURDAY: 'Sáb',
  SUNDAY: 'Dom',
};

// Orden en que se muestran los días (lunes primero).
const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

// Horario por defecto para todos los días:
// Lunes–Sábado trabajan de 9:00 a 18:00; Domingo no trabaja.
// .map() recorre DAY_ORDER y crea un objeto Schedule por cada día.
// new Date().toISOString().split('T')[0] obtiene la fecha de hoy en formato
// "YYYY-MM-DD" (ej: "2026-06-24"). split('T')[0] toma solo la parte antes de la T.
const DEFAULT_SCHEDULES: Schedule[] = DAY_ORDER.map((day) => ({
  dayOfWeek: day,
  isWorking: day !== 'SUNDAY',   // todos trabajan menos el domingo
  startTime: '09:00',
  endTime: '18:00',
  effectiveFrom: new Date().toISOString().split('T')[0],
}));

// ─── generateTimeOptions ────────────────────────────────────
// Genera todas las opciones de tiempo en intervalos de 15 minutos,
// desde 00:00 hasta 23:45.
function generateTimeOptions() {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    // h va de 0 a 23 (las 24 horas del día).
    for (let m = 0; m < 60; m += 15) {
      // m va de 0 a 45 en saltos de 15 (0, 15, 30, 45).
      // String(h).padStart(2, '0') convierte 9 → "09" (siempre 2 dígitos).
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return options;
  // Resultado: ["00:00", "00:15", "00:30", ..., "23:45"] — 96 opciones en total.
}

// Calculamos las opciones una sola vez al cargar el módulo (no en cada render).
const TIME_OPTIONS = generateTimeOptions();

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────
export function EmployeeScheduleEditor({ employeeId }: EmployeeScheduleEditorProps) {
  const queryClient = useQueryClient();

  // Estado: array de los 7 días con su configuración de horario.
  // Se inicializa con los defaults y se sobreescribe cuando llegan
  // datos del servidor (en useEffect).
  const [schedules, setSchedules] = useState<Schedule[]>(DEFAULT_SCHEDULES);

  // Estado: true si el usuario hizo algún cambio que aún no se guardó.
  // Controla si el botón "Guardar" está habilitado.
  const [hasChanges, setHasChanges] = useState(false);

  // ─── QUERY: horario actual del empleado ─────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['employee-schedules', employeeId],
    queryFn: () =>
      api.get<{ data: Schedule[] }>(`/api/employees/${employeeId}/schedules`),
  });

  // Hook que detecta si el tenant es freelancer para saber si aplican
  // restricciones del horario del negocio.
  const { isFreelancer } = useTenantTier();

  // ─── QUERY: horario del negocio ─────────────────────────
  // Carga los días en que el negocio está abierto/cerrado.
  // Solo se ejecuta si NO es freelancer (los freelancers son libres).
  const { data: businessHoursData } = useQuery({
    queryKey: ['business-hours'],
    queryFn: () => api.get<{ data: BusinessHour[] }>('/api/tenant/business-hours'),
    // Freelancer no tiene "horario de negocio" que limite el suyo.
    enabled: !isFreelancer,
  });

  // Map of days the business is closed. Freelancer puede activar/desactivar
  // cualquier dia libremente (no hay "negocio cerrado" que lo restrinja).
  // Construimos un Set con los días en que el negocio está CERRADO.
  // Si es freelancer, el Set es vacío (ningún día restringido).
  const businessClosedDays = new Set<string>(
    isFreelancer
      ? []
      : (businessHoursData?.data || [])
          // .filter(): solo días cerrados (isOpen === false)
          .filter((h) => !h.isOpen)
          // .map(): extraemos solo el nombre del día
          .map((h) => h.dayOfWeek),
  );

  // ─── useEffect: sincronizar datos del servidor ───────────
  // useEffect se ejecuta después del render, cuando cambia "data".
  // Su propósito es actualizar el estado local cuando el servidor
  // devuelve el horario guardado del empleado.
  useEffect(() => {
    // Solo actualizamos si el servidor devolvió datos (y son los reales).
    if (data?.data && data.data.length > 0) {
      const fetched = data.data;
      // Mezclamos los datos del servidor con los defaults.
      // Para cada día del orden DAY_ORDER:
      //   - Si el servidor tiene datos para ese día, los usamos.
      //   - Si no, usamos el default correspondiente.
      const merged = DAY_ORDER.map((day) => {
        // .find() busca en el array fetched el horario de este día.
        const found = fetched.find((s) => s.dayOfWeek === day);
        if (found) {
          return {
            ...found,   // copiamos todos los campos del servidor
            // Nos aseguramos de que startTime y endTime tengan valor.
            startTime: found.startTime || '09:00',
            endTime: found.endTime || '18:00',
            // effectiveFrom puede venir como "2026-06-24T00:00:00Z"
            // (con hora). Tomamos solo la parte de la fecha (antes de la T).
            effectiveFrom: typeof found.effectiveFrom === 'string'
              ? found.effectiveFrom.split('T')[0]
              : new Date().toISOString().split('T')[0],
          };
        }
        // Si no hay dato del servidor para este día, usamos el default.
        // El "!" al final le dice a TypeScript que .find() nunca devolverá
        // undefined aquí (porque el array DEFAULT_SCHEDULES tiene los 7 días).
        return DEFAULT_SCHEDULES.find((d) => d.dayOfWeek === day)!;
      });
      setSchedules(merged);
      setHasChanges(false);  // al cargar del servidor no hay cambios pendientes
    }
  }, [data]);
  // [data] = el array de dependencias. useEffect se ejecuta cada vez que
  // "data" cambia. Si solo se pusiera [], se ejecutaría una sola vez al montar.

  // ─── MUTATION: guardar horario ──────────────────────────
  const saveMutation = useMutation({
    mutationFn: (payload: { schedules: Schedule[] }) =>
      api.put(`/api/employees/${employeeId}/schedules`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-schedules', employeeId] });
      setHasChanges(false);  // ya no hay cambios pendientes
    },
  });

  // ─── updateDay ───────────────────────────────────────────
  // Actualiza un campo específico de un día específico en el estado.
  // "dayOfWeek": cuál día actualizar (ej: "MONDAY")
  // "field": qué campo del Schedule cambiar (ej: "startTime", "isWorking")
  // "value": el nuevo valor (puede ser string o boolean)
  function updateDay(dayOfWeek: string, field: string, value: string | boolean) {
    setSchedules((prev) =>
      // .map() recorre todos los días y devuelve un nuevo array.
      // Para el día que coincide, creamos un nuevo objeto con el campo
      // actualizado usando computed property name: [field] = value.
      // Para los demás días, devolvemos el objeto tal cual (s).
      prev.map((s) =>
        s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s,
      ),
    );
    setHasChanges(true);  // hay cambios sin guardar
  }

  // Replica el horario del primer dia laboral activo (lunes por orden) a
  // todos los demas dias en los que el negocio no este cerrado. Util para
  // empleados que trabajan el mismo horario de lunes a sabado.
  function applyToAllDays() {
    // Buscamos el primer día que trabaja y que el negocio esté abierto.
    const template = schedules.find(
      (s) => s.isWorking && !businessClosedDays.has(s.dayOfWeek),
    );
    if (!template) {
      // Si no hay ningún día laborable configurado, avisamos.
      alert(
        'Configura el horario en al menos un dia laboral antes de replicar.',
      );
      return;
    }
    setSchedules((prev) =>
      prev.map((s) => {
        // Si el negocio está cerrado ese día, no cambiamos nada.
        if (businessClosedDays.has(s.dayOfWeek)) return s;
        // Para los demás días, aplicamos el horario del template.
        return {
          ...s,
          isWorking: true,
          startTime: template.startTime,
          endTime: template.endTime,
        };
      }),
    );
    setHasChanges(true);
  }

  // ─── handleSave ──────────────────────────────────────────
  function handleSave() {
    // Validate startTime < endTime for working days
    // Buscamos si hay algún día laborable donde la hora de inicio sea
    // mayor o igual a la hora de fin (configuración inválida).
    // Se comparan como strings: "09:00" < "18:00" funciona en orden lexicográfico.
    const invalid = schedules.find(
      (s) => s.isWorking && !businessClosedDays.has(s.dayOfWeek) && s.startTime >= s.endTime,
    );
    if (invalid) {
      alert(`${DAY_LABELS[invalid.dayOfWeek]}: La hora de inicio debe ser anterior a la hora de fin.`);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    saveMutation.mutate({
      // .map() transforma los Schedule a solo los campos que el backend necesita.
      schedules: schedules.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        isWorking: s.isWorking,
        startTime: s.startTime,
        endTime: s.endTime,
        effectiveFrom: today,  // el nuevo horario aplica desde hoy
      })),
    });
  }

  // ─── Estado de carga ─────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        {/* Array.from({ length: 7 }) crea un array de 7 elementos undefined.
            Usamos "_" (convención para variable no usada) e "i" para la key. */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-12 bg-[var(--bg-muted)] rounded-lg animate-pulse" />
          // "animate-pulse" crea el efecto de parpadeo del skeleton.
        ))}
      </div>
    );
  }

  // ─── JSX principal ───────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-[var(--text-secondary)] flex-1 min-w-[200px]">
          Configura los días y horarios de trabajo de este empleado.
        </p>
        {/* Botón para replicar el horario del primer día a todos */}
        <button
          type="button"
          onClick={applyToAllDays}
          className="px-3 py-1.5 text-xs font-semibold rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5 flex-shrink-0"
          title="Replica el horario del primer dia laboral a toda la semana"
        >
          {/* Ícono de flechas bidireccionales */}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Aplicar a todos los días
        </button>
      </div>

      {/* Lista de días */}
      <div className="space-y-2">
        {/* .map() recorre los 7 horarios (uno por día) y genera una fila. */}
        {schedules.map((day) => {
          // Comprobamos si el negocio está cerrado este día.
          const businessClosed = businessClosedDays.has(day.dayOfWeek);

          return (
            <div
              key={day.dayOfWeek}  // clave única para React
              // Estilo condicional con operador ternario anidado:
              // - Si el negocio está cerrado: fondo rojo claro
              // - Si el empleado trabaja: fondo normal (blanco/superficie)
              // - Si no trabaja: fondo gris sutil
              className={`flex items-center gap-2 p-2.5 md:p-3 rounded-xl border transition-colors ${
                businessClosed
                  ? 'bg-red-50/50 border-red-100'
                  : day.isWorking
                    ? 'bg-[var(--bg-surface)] border-[var(--border)]'
                    : 'bg-[var(--bg-subtle)] border-gray-100'
              }`}
            >
              {/* Nombre del día: versión corta en móvil, larga en desktop */}
              <div className="w-12 md:w-24 flex-shrink-0">
                <span className={`text-sm font-medium ${businessClosed ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                  {/* "md:hidden" = solo visible en pantallas menores que md (móvil) */}
                  <span className="md:hidden">{DAY_LABELS_SHORT[day.dayOfWeek]}</span>
                  {/* "hidden md:inline" = oculto en móvil, visible desde md+ */}
                  <span className="hidden md:inline">{DAY_LABELS[day.dayOfWeek]}</span>
                </span>
              </div>

              {/* Si el negocio está cerrado, mostramos badge y no el toggle */}
              {businessClosed ? (
                <div className="flex items-center gap-2 flex-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    {/* Ícono de advertencia */}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v.01M12 12v-4m0 0a9 9 0 110 18 9 9 0 010-18z" />
                    </svg>
                    Negocio cerrado
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    No se pueden agendar citas este día
                  </span>
                </div>
              ) : (
                // Si el negocio NO está cerrado, mostramos el toggle y las horas.
                <>
                  {/* Toggle switch para activar/desactivar el día */}
                  <button
                    type="button"
                    // Al hacer clic, invertimos isWorking del día.
                    // !day.isWorking = si era true, ahora false; y viceversa.
                    onClick={() => updateDay(day.dayOfWeek, 'isWorking', !day.isWorking)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                      day.isWorking ? 'bg-primary-600' : 'bg-gray-300'
                    }`}
                  >
                    {/* Bolita blanca del toggle que se desliza */}
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-[var(--bg-surface)] transition-transform ${
                        day.isWorking ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>

                  {/* Selectores de hora: solo visibles si el día está activo.
                      Si isWorking es false, los selectores desaparecen. */}
                  {day.isWorking && (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {/* Selector de hora de inicio */}
                      <select
                        value={day.startTime}
                        onChange={(e) => updateDay(day.dayOfWeek, 'startTime', e.target.value)}
                        className="py-1.5 text-sm rounded-lg border border-gray-300 bg-white px-2 min-w-0 flex-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {/* Genera 96 <option> (una por cada intervalo de 15min). */}
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      {/* Separador visual entre las dos horas */}
                      <span className="text-[var(--text-muted)] text-xs flex-shrink-0">a</span>
                      {/* Selector de hora de fin */}
                      <select
                        value={day.endTime}
                        onChange={(e) => updateDay(day.dayOfWeek, 'endTime', e.target.value)}
                        className="py-1.5 text-sm rounded-lg border border-gray-300 bg-white px-2 min-w-0 flex-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Botón de guardar */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          // Deshabilitado si no hay cambios O si la mutación está en progreso.
          disabled={!hasChanges || saveMutation.isPending}
          className="btn-primary disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Guardando...' : 'Guardar Horario'}
        </button>
      </div>

      {/* Mensajes de resultado de la operación de guardar. */}
      {/* "saveMutation.isSuccess" es true si la última mutación tuvo éxito. */}
      {saveMutation.isSuccess && (
        <p className="text-sm text-green-600 text-right">
          Horario guardado correctamente
        </p>
      )}
      {/* "saveMutation.isError" es true si la última mutación falló. */}
      {saveMutation.isError && (
        <p className="text-sm text-red-600 text-right">
          Error al guardar el horario
        </p>
      )}
    </div>
  );
}
