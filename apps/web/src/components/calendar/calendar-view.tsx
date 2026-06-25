// 'use client': este componente se ejecuta en el navegador (necesita hooks,
// eventos del mouse, referencias DOM, etc.).
'use client';

// Hooks de React que necesitamos:
// - useMemo: para cálculos derivados que no queremos repetir en cada render
// - useState: para variables reactivas (estado del drag, hora actual)
// - useEffect: para efectos secundarios (sincronizar scroll, actualizar reloj)
// - useRef: para referencias al DOM (scrollable grid) sin provocar re-render
// - useCallback: para estabilizar funciones que son dependencias de useEffect
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
// Link: componente de Next.js para navegación entre páginas (genera <a> optimizados).
import Link from 'next/link';
// dayjs: librería para manipular fechas. Dayjs = tipo TypeScript del objeto.
import dayjs, { type Dayjs } from 'dayjs';
// formatTime: convierte "HH:mm" a presentación legible
import { formatTime } from '@/lib/utils';
// formatBookingTime: extrae la hora "UTC raw" de un ISO string sin convertir zona horaria.
// Explicación del patrón UTC raw: las citas se guardan como hora del negocio
// (p. ej. "10:00 AM") pero en UTC. Si usáramos .toLocaleDateString(), se
// desplazaría con el offset del servidor. formatBookingTime evita ese problema.
import { formatBookingTime } from '@/lib/booking-time';

// ── Interfaces TypeScript ──────────────────────────────────────────────────
// Cada interfaz define la "forma" de un objeto de datos. TypeScript las usa
// para detectar errores en tiempo de compilación.

// Un ítem dentro de una cita (un servicio realizado).
// Los campos "Snapshot" son los valores al momento de la reserva (inmutables).
interface AppointmentItem {
  serviceNameSnapshot: string;
  priceSnapshot?: number;
  durationSnapshot?: number;
}

// Una cita completa con sus relaciones opcionales (client, employee, items).
// Los campos opcionales (?) pueden no venir en la respuesta del backend.
interface Appointment {
  id: string;
  clientId: string;
  client?: { firstName: string; lastName: string };
  employeeId: string;
  employee?: { firstName: string; lastName: string; color?: string };
  startTime: string;
  endTime: string;
  status: string;
  items?: AppointmentItem[];
}

// Cierre de negocio (por vacaciones, festivo, etc.). Exportado para uso externo.
export interface BusinessClosure {
  id: string;
  startDate: string; // Fecha de inicio (YYYY-MM-DD o ISO)
  endDate: string;
  reason: string;    // Texto que se muestra en el overlay del día cerrado
}

// Ausencia de un empleado (permisos, descanso, enfermedad). Exportado.
export interface EmployeeTimeOff {
  id: string;
  employeeId: string;
  startDatetime: string;
  endDatetime: string;
  reason?: string;  // Opcional: motivo de la ausencia
  employee?: { id: string; firstName: string; lastName: string; color?: string };
}

// Configuración de horario de un día de la semana.
export interface BusinessHourEntry {
  dayOfWeek: string;  // "MONDAY", "TUESDAY", etc.
  isOpen: boolean;    // Si el negocio abre ese día
  startTime?: string; // "HH:mm" — hora de apertura
  endTime?: string;   // "HH:mm" — hora de cierre
}

// Empleado que trabaja en el día mostrado (para las columnas de vista día).
export interface DayEmployee {
  id: string;
  firstName: string;
  lastName: string;
  color?: string;         // Color hexadecimal (#008080) del empleado en el calendario
  avatarUrl?: string | null;
}

// Props del componente CalendarView.
// onSlotClick: se llama al hacer click en un espacio vacío del grid.
// onAppointmentClick: se llama al hacer click en un bloque de cita.
// onAppointmentDragEnd: se llama al soltar una cita arrastrada (drag & drop).
// ? en las props = opcionales.
interface CalendarViewProps {
  date: Dayjs;
  appointments: Appointment[];
  viewMode: 'day' | 'week';
  onSlotClick: (time: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  onAppointmentDragEnd?: (appointmentId: string, newStartTime: string) => void;
  closures?: BusinessClosure[];
  employeeTimeOffs?: EmployeeTimeOff[];
  businessHours?: BusinessHourEntry[];
  /** Empleados que trabajan en `date` (solo se usa en vista 'day' para hacer columnas por empleado). */
  dayEmployees?: DayEmployee[];
  /** Click en el header de un día (solo aplica a vista semana) — típicamente navega a vista día. */
  onDayHeaderClick?: (date: Dayjs) => void;
}

// Column: una columna del grid del calendario. Puede ser un día (vista semana)
// o un empleado (vista día con múltiples profesionales).
interface Column {
  key: string;        // Identificador único de la columna (fecha o employeeId)
  date: Dayjs;        // La fecha que representa esta columna
  /** Si está presente, esta columna pertenece a un empleado específico (vista día). */
  employee?: DayEmployee;
}

// ── Constantes del layout del calendario ──────────────────────────────────
// Estas constantes controlan la geometría del grid. Cambiarlas afecta
// el tamaño de los bloques y la relación entre píxeles y minutos.
const HOUR_START = 6;                     // Primera hora visible (6 AM)
const HOUR_END = 22;                      // Última hora visible (10 PM)
const TOTAL_HOURS = HOUR_END - HOUR_START; // 16 horas totales
const SLOT_MINUTES = 30;                  // Cada celda del grid = 30 minutos
const SLOT_HEIGHT = 40;                   // Alto en píxeles de cada slot de 30 min
const TOTAL_SLOTS = TOTAL_HOURS * 2;      // 32 slots (16h × 2 slots/h)
const HEADER_HEIGHT = 0; // header is outside the grid body
const HORA_COL_WIDTH = 60;               // Ancho de la columna de etiquetas de hora (px)
const EMPLOYEE_COL_WIDTH = 168;          // Ancho de cada columna de empleado (px, scroll horizontal)
const SNAP_MINUTES = 15;                 // Las citas se "enganchan" a intervalos de 15 min al arrastrar

// Conjunto (Set) de estados en que una cita puede arrastrarse (drag & drop).
// Set permite verificar pertenencia en O(1): DRAGGABLE_STATUSES.has('pending') → true.
const DRAGGABLE_STATUSES = new Set(['pending', 'confirmed', 'rescheduled']);

// ── Funciones de utilidad ──────────────────────────────────────────────────

// hexToRgb: convierte un color hexadecimal "#RRGGBB" a su representación RGB.
// Usada para construir colores semi-transparentes de fondo de los bloques de cita.
// /regex/.exec(hex): ejecuta la expresión regular y devuelve los grupos capturados.
// parseInt(result[1], 16): convierte la cadena hexadecimal a número decimal.
// Si el hex no es válido, devuelve null.
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

// timeToMinutes: convierte un timestamp ISO a minutos desde medianoche.
// IMPORTANTE — patrón UTC raw: las citas se guardan como "hora del negocio"
// interpretada como UTC. Por eso usamos getUTCHours()/getUTCMinutes() en vez
// de getHours()/getMinutes(). Si usáramos la hora local, la cita de las 10:00
// se vería a las 04:00 en un servidor UTC-6.
function timeToMinutes(isoTime: string): number {
  // UTC raw — las citas se guardan como "hora del negocio" interpretada
  // como UTC (sin offset real), asi que leemos UTC para no shiftear.
  const d = new Date(isoTime);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

// minutesToTimeStr: convierte minutos desde medianoche a "HH:mm".
// Math.floor(minutes / 60): la parte entera de las horas.
// minutes % 60: el resto son los minutos.
// .padStart(2, '0'): añade un cero a la izquierda si el número es de 1 dígito ("9" → "09").
function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// formatHourLabel: convierte un número de hora (6–22) a texto AM/PM para las etiquetas.
// Ejemplo: 6→"6 AM", 12→"12 PM", 14→"2 PM".
function formatHourLabel(hour: number): string {
  if (hour === 12) return '12 PM';
  if (hour > 12) return `${hour - 12} PM`;
  return `${hour} AM`;
}

// STATUS_DECORATIONS: clases CSS extra por estado. Canceladas aparecen tachadas y opacas.
// Record<string, string>: objeto con claves y valores string.
const STATUS_DECORATIONS: Record<string, string> = {
  cancelled: 'line-through opacity-50',
  no_show: 'opacity-60',
};

// STATUS_DOT_COLORS: color del pequeño círculo de estado en cada bloque de cita.
// Permite identificar visualmente el estado sin leer el texto.
const STATUS_DOT_COLORS: Record<string, string> = {
  pending: '#eab308',
  confirmed: '#22c55e',
  rescheduled: '#f97316',
  in_progress: '#3b82f6',
  completed: '#9ca3af',
  cancelled: '#ef4444',
  no_show: '#f97316',
};

// LayoutInfo: posición de una cita en el sistema de columnas de solapamiento.
// column: índice de sub-columna (0, 1, 2…) cuando hay citas simultáneas.
// totalColumns: cuántas sub-columnas tiene ese grupo.
interface LayoutInfo {
  column: number;
  totalColumns: number;
}

// computeOverlapLayout: algoritmo de layout para citas que se solapan en el tiempo.
// Objetivo: cuando 2+ citas ocurren al mismo tiempo, mostrarlas LADO A LADO
// (como los navegadores web muestran eventos del calendario).
// Devuelve un Map de { appointmentId → LayoutInfo }.
//
// Algoritmo:
//   1. Ordenar las citas por hora de inicio.
//   2. Agrupar en "clusters": citas que se solapan entre sí.
//   3. Dentro de cada cluster, asignar citas a sub-columnas usando el método
//      "first fit": intentar colocar la cita en una columna existente donde
//      no haya conflicto; si no hay, crear una nueva columna.
//   4. Registrar el resultado (column, totalColumns) por cada cita.
function computeOverlapLayout(appointments: Appointment[]): Map<string, LayoutInfo> {
  const result = new Map<string, LayoutInfo>();
  if (appointments.length === 0) return result; // Sin citas → mapa vacío

  // Ordenamos por hora de inicio (getTime() devuelve milisegundos desde epoch).
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  // PASO 1: Agrupar en clusters de citas solapadas.
  const clusters: Appointment[][] = [];
  let currentCluster: Appointment[] = [sorted[0]];
  let clusterEnd = new Date(sorted[0].endTime).getTime(); // Fin más tardío del cluster

  for (let i = 1; i < sorted.length; i++) {
    const apt = sorted[i];
    const aptStart = new Date(apt.startTime).getTime();
    if (aptStart < clusterEnd) {
      // Se solapa con el cluster actual → añadir al mismo cluster
      currentCluster.push(apt);
      // Extendemos el fin del cluster al máximo (Math.max)
      clusterEnd = Math.max(clusterEnd, new Date(apt.endTime).getTime());
    } else {
      // No se solapa → finalizar el cluster actual y empezar uno nuevo
      clusters.push(currentCluster);
      currentCluster = [apt];
      clusterEnd = new Date(apt.endTime).getTime();
    }
  }
  clusters.push(currentCluster); // Añadir el último cluster

  // PASO 2: Asignar sub-columnas dentro de cada cluster.
  for (const cluster of clusters) {
    const columns: Appointment[][] = []; // columns[i] = citas en la sub-columna i
    for (const apt of cluster) {
      const aptStart = new Date(apt.startTime).getTime();
      let placed = false;
      // Intentar colocar la cita en una columna existente ("first fit").
      for (let col = 0; col < columns.length; col++) {
        const lastInCol = columns[col][columns[col].length - 1];
        // Si la cita anterior en esa columna ya terminó → no hay conflicto.
        if (new Date(lastInCol.endTime).getTime() <= aptStart) {
          columns[col].push(apt);
          placed = true;
          break; // Encontramos lugar → salir del bucle
        }
      }
      if (!placed) {
        // No cabe en ninguna columna existente → nueva sub-columna
        columns.push([apt]);
      }
    }
    // PASO 3: Registrar el resultado (column, totalColumns) por cada cita.
    const totalColumns = columns.length; // Cuántas sub-columnas tiene este cluster
    // .forEach((col, colIdx) => ...): itera el array con (valor, índice).
    columns.forEach((col, colIdx) => {
      for (const apt of col) {
        // Guardamos en el Map: id de la cita → su posición (índice y total de columnas).
        result.set(apt.id, { column: colIdx, totalColumns });
      }
    });
  }

  return result;
}

// isDateInClosure: verifica si una fecha cae dentro de algún cierre de negocio.
// Devuelve el BusinessClosure si aplica, o null si el día está abierto.
// Comparamos cadenas "YYYY-MM-DD" directamente (son ordenables lexicográficamente).
function isDateInClosure(date: Dayjs, closures: BusinessClosure[]): BusinessClosure | null {
  const dateStr = date.format('YYYY-MM-DD');
  for (const c of closures) {
    // split('T')[0]: toma solo la fecha (descarta la hora si viene con T).
    const cStart = c.startDate.split('T')[0];
    const cEnd = c.endDate.split('T')[0];
    if (dateStr >= cStart && dateStr <= cEnd) return c; // Dentro del rango → cerrado
  }
  return null; // No está cerrado ese día
}

// DragState: estado del drag & drop en curso.
// Solo existe cuando el usuario está arrastrando una cita.
// ghostTop, ghostDayIndex, ghostMinutes: posición visual del "fantasma" durante el drag.
interface DragState {
  appointmentId: string;    // ID de la cita que se está arrastrando
  appointment: Appointment; // Datos completos de la cita
  startX: number;           // Posición X del mouse al empezar el drag
  startY: number;           // Posición Y del mouse al empezar el drag
  isDragging: boolean;      // true = drag activo; false = podría ser un simple click
  ghostTop: number;         // Posición top (px) del rectángulo fantasma
  ghostDayIndex: number;    // Columna destino del fantasma
  ghostMinutes: number;     // Minutos desde medianoche de la nueva hora destino
  originalDayIndex: number; // Columna original antes de arrastrar
  durationMinutes: number;  // Duración de la cita (para dibujar el fantasma del mismo tamaño)
}

// ── Componente principal CalendarView ─────────────────────────────────────
// Muestra el grid del calendario con:
//   - Vista semana: 7 columnas, una por día
//   - Vista día: una columna por empleado (con scroll horizontal si hay muchos)
// Soporta drag & drop de citas, indicador de hora actual, overlays de cierre
// y ausencias, y click en slots vacíos para crear nuevas citas.
export function CalendarView({
  date,
  appointments,
  viewMode,
  onSlotClick,
  onAppointmentClick,
  onAppointmentDragEnd,
  closures = [],          // Default a array vacío (= sin cierres)
  employeeTimeOffs = [],
  businessHours = [],
  dayEmployees = [],
  onDayHeaderClick,
}: CalendarViewProps) {
  // gridBodyRef: referencia al div scrollable del grid. Necesaria para:
  //   - Calcular posiciones durante el drag & drop (getBoundingClientRect)
  //   - Sincronizar scroll horizontal con el header de empleados
  // useRef<HTMLDivElement>(null): inicializa en null; se asigna cuando el DOM se monta.
  const gridBodyRef = useRef<HTMLDivElement>(null);
  // headerRef: referencia al div del header (columnas de empleados). Sincroniza su
  // scroll horizontal con el gridBodyRef para que ambos se muevan juntos.
  const headerRef = useRef<HTMLDivElement>(null);
  // dragState: estado del drag en curso (null = no hay drag activo).
  // useState<DragState | null>(null): inicia sin drag.
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Sincroniza el scroll horizontal entre el header de empleados y el grid.
  // Problema: si el usuario scrollea en el body, el header debe seguir; y viceversa.
  // Solución: listeners de 'scroll' en ambos con un flag `syncing` para evitar
  // que los eventos se disparen recursivamente (bucle infinito de scroll).
  // Sincroniza scroll horizontal en ambos sentidos entre header y body
  // (vista 'day' empleado): el usuario puede deslizar desde la fila de
  // avatares o desde el grid, ambos se mueven juntos.
  useEffect(() => {
    const body = gridBodyRef.current;
    const header = headerRef.current;
    if (!body || !header) return; // Si alguno no existe (aún no montado) → salir
    let syncing = false; // Flag para evitar bucle infinito de eventos
    function syncFromBody() {
      if (syncing || !header || !body) return;
      syncing = true;
      header.scrollLeft = body.scrollLeft; // Sincroniza header con body
      // requestAnimationFrame: ejecuta el callback en el próximo frame del navegador.
      // Lo usamos para resetear `syncing` DESPUÉS de que el evento de scroll
      // del header (causado por la línea anterior) se haya procesado.
      requestAnimationFrame(() => { syncing = false; });
    }
    function syncFromHeader() {
      if (syncing || !header || !body) return;
      syncing = true;
      body.scrollLeft = header.scrollLeft; // Sincroniza body con header
      requestAnimationFrame(() => { syncing = false; });
    }
    body.addEventListener('scroll', syncFromBody);
    header.addEventListener('scroll', syncFromHeader);
    // Función de limpieza: se ejecuta cuando el componente se desmonta.
    // Elimina los listeners para evitar memory leaks.
    return () => {
      body.removeEventListener('scroll', syncFromBody);
      header.removeEventListener('scroll', syncFromHeader);
    };
  }, []); // [] = solo se ejecuta al montar el componente (no tiene dependencias)

  // nowMinutes: minutos desde medianoche de la hora actual (para la línea roja).
  // useState con función inicializadora: la función se ejecuta solo una vez.
  const [nowMinutes, setNowMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  // Actualiza la hora cada 60 segundos para mover la línea indicadora.
  // setInterval devuelve un ID. Al limpiar el efecto, llamamos clearInterval.
  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000); // 60000 ms = 1 minuto
    return () => clearInterval(interval); // Limpieza: detiene el intervalo al desmontar
  }, []); // [] = solo configura el intervalo una vez

  // ── Derivados calculados con useMemo ─────────────────────────────────────
  // useMemo evita recalcular valores complejos en cada render.
  // Solo recalcula cuando cambian las dependencias del array [dep1, dep2...].

  // columns: las columnas del grid (una por día en semana, una por empleado en día).
  // Las columnas del grid:
  // - Vista semana: 7 columnas, una por día
  // - Vista día con empleados que trabajan: una columna por empleado
  // - Vista día sin empleados: una columna única del día (fallback)
  const columns: Column[] = useMemo(() => {
    if (viewMode === 'week') {
      // Vista semana: 7 columnas empezando desde el inicio de la semana.
      // date.startOf('week') = el domingo (o lunes según locale) de esa semana.
      // .add(i, 'day'): suma i días al primer día.
      return Array.from({ length: 7 }, (_, i) => {
        const d = date.startOf('week').add(i, 'day');
        return { key: d.format('YYYY-MM-DD'), date: d };
      });
    }
    if (dayEmployees && dayEmployees.length > 0) {
      // Vista día con empleados: una columna por empleado.
      // .map() transforma el array de empleados en array de Column.
      return dayEmployees.map((emp) => ({
        key: emp.id,   // El ID del empleado es la clave única de la columna
        date,          // Todas las columnas son el mismo día
        employee: emp, // La columna lleva la referencia al empleado
      }));
    }
    // Fallback: una sola columna con el día actual (sin empleados).
    return [{ key: date.format('YYYY-MM-DD'), date }];
  }, [date, viewMode, dayEmployees]); // Recalcula si cambia la fecha, modo o empleados

  // numDays: número de columnas del grid (7 en semana, N empleados en día).
  const numDays = columns.length;

  // isToday: helper que devuelve true si un objeto Dayjs es el día de hoy.
  const isToday = (d: Dayjs) => d.isSame(dayjs(), 'day');

  // todayIndex: el índice de la columna "hoy" en el array columns.
  // Usado para posicionar la línea de hora actual solo en la columna correcta.
  // -1 si "hoy" no está visible (semana que no incluye hoy, por ejemplo).
  const todayIndex = useMemo(() => {
    const today = dayjs();
    // En vista día por empleado, todas las columnas son el mismo día. Si es hoy,
    // marcamos col 0 para que la linea AHORA se renderice una sola vez (a lo ancho).
    if (viewMode === 'day') {
      return columns[0]?.date.isSame(today, 'day') ? 0 : -1;
    }
    // .findIndex devuelve el índice del primer elemento que cumple la condición.
    return columns.findIndex((c) => c.date.isSame(today, 'day'));
  }, [columns, viewMode]);

  // appointmentsByDay: Map de { columnIndex → Appointment[] }.
  // Agrupa las citas por columna para que el render sepa qué citas mostrar en cada columna.
  // Group appointments by column index
  // - Semana: una col por día, filtrar por mismo día
  // - Día por empleado: filtrar por mismo día Y mismo empleado
  const appointmentsByDay = useMemo(() => {
    const map = new Map<number, Appointment[]>();
    columns.forEach((_, i) => map.set(i, [])); // Inicializa cada columna con array vacío
    for (const apt of appointments) {
      const aptDay = dayjs(apt.startTime); // Día de la cita
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (!aptDay.isSame(col.date, 'day')) continue; // ¿Es el mismo día?
        // En vista día por empleado, también filtramos por empleado.
        if (col.employee && apt.employeeId !== col.employee.id) continue;
        // ! (non-null assertion): le decimos a TypeScript que map.get(i) no es undefined.
        map.get(i)!.push(apt);
        // En vista semana, cada cita pertenece a UN único día → stop.
        if (viewMode === 'week') break; // en semana cada cita va a un único día
      }
    }
    return map;
  }, [appointments, columns, viewMode]);

  // layoutsByDay: Map de { columnIndex → overlapLayout }.
  // El overlap layout de cada columna se calcula con computeOverlapLayout.
  // Overlap layouts per day
  const layoutsByDay = useMemo(() => {
    const map = new Map<number, Map<string, LayoutInfo>>();
    // for...of itera un iterable (Map, Set, Array, etc.).
    // appointmentsByDay.entries() devuelve [key, value] por cada entrada.
    for (const [dayIdx, dayApts] of appointmentsByDay) {
      map.set(dayIdx, computeOverlapLayout(dayApts));
    }
    return map;
  }, [appointmentsByDay]);

  // closureByDay: array paralelo a columns que indica si hay cierre de negocio.
  // closureByDay[i] = null → el día i está abierto.
  // closureByDay[i] = BusinessClosure → hay cierre; mostramos el overlay "Cerrado".
  // Closures por columna. En vista día las columnas comparten el mismo día,
  // por lo que el closure aplica a todas o a ninguna.
  const closureByDay = useMemo(() => {
    return columns.map((c) => isDateInClosure(c.date, closures));
  }, [columns, closures]);

  // businessHoursByDow: Map de { dayOfWeek (0–6) → horario }.
  // DOW_MAP convierte el nombre del día en string ("MONDAY") a número (1).
  // El horario se convierte a minutos desde medianoche para compararlo con slots.
  // Business hours per day of week (0=Sun..6=Sat)
  const DOW_MAP: Record<string, number> = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
  const businessHoursByDow = useMemo(() => {
    const map = new Map<number, { isOpen: boolean; start: number; end: number }>();
    for (const bh of businessHours) {
      const dow = DOW_MAP[bh.dayOfWeek]; // Número del día (0–6)
      if (dow === undefined) continue;    // Si el día no es reconocido → saltar
      // Convertir "HH:mm" a minutos: parseInt(horas) * 60 + parseInt(minutos).
      const start = bh.startTime ? parseInt(bh.startTime.split(':')[0]) * 60 + parseInt(bh.startTime.split(':')[1]) : HOUR_START * 60;
      const end = bh.endTime ? parseInt(bh.endTime.split(':')[0]) * 60 + parseInt(bh.endTime.split(':')[1]) : HOUR_END * 60;
      map.set(dow, { isOpen: bh.isOpen, start, end });
    }
    return map;
  }, [businessHours]);

  // timeOffsByDay: array paralelo a columns con las ausencias de empleados para cada columna.
  // En vista día: solo las ausencias del empleado de esa columna.
  // En vista semana: todas las ausencias del día.
  // Time-offs por columna. En vista día, cada columna solo ve los time-offs
  // del empleado al que pertenece. En vista semana, todos los time-offs del día.
  const timeOffsByDay = useMemo(() => {
    return columns.map((col) => {
      const dayStr = col.date.format('YYYY-MM-DD');
      // .filter() devuelve un nuevo array con los elementos que cumplen la condición.
      return employeeTimeOffs.filter((to) => {
        const toStart = to.startDatetime.split('T')[0]; // Solo la fecha
        const toEnd = to.endDatetime.split('T')[0];
        // Comprobación de rango: el día cae dentro del rango de ausencia.
        const dateMatches = dayStr >= toStart && dayStr <= toEnd;
        if (!dateMatches) return false;
        // En vista día por empleado: solo ausencias del empleado de esta columna.
        if (col.employee) return to.employeeId === col.employee.id;
        return true; // Vista semana: cualquier ausencia de ese día
      });
    });
  }, [columns, employeeTimeOffs]);

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  // El drag & drop usa eventos del mouse del DOM nativo (no react-dnd) para
  // tener control total sobre la posición del "fantasma" y la lógica de snap.

  // pixelToSlot: convierte coordenadas de mouse (clientX, clientY) a la posición
  // en el grid (columna + hora en minutos). Devuelve null si está fuera del grid.
  // useCallback([deps]) memoriza la función y solo la recreca si cambia numDays.
  // Necesario porque esta función es dependencia del useEffect del drag.
  const pixelToSlot = useCallback(
    (clientX: number, clientY: number): { dayIndex: number; totalMinutes: number } | null => {
      if (!gridBodyRef.current) return null;
      // getBoundingClientRect(): devuelve las coordenadas del elemento en la ventana.
      const rect = gridBodyRef.current.getBoundingClientRect();
      // x relativa al grid (0 = borde izquierdo del grid)
      const x = clientX - rect.left;
      // y relativa al grid + scroll (el grid puede estar scrolleado hacia abajo)
      const y = clientY - rect.top + gridBodyRef.current.scrollTop;

      // Calculate day index from x position
      // (rect.width - HORA_COL_WIDTH): ancho del área de columnas (sin la columna de horas).
      // dayWidth: ancho de cada columna de día.
      // Math.floor((x - HORA_COL_WIDTH) / dayWidth): qué columna tocó el usuario.
      const dayWidth = (rect.width - HORA_COL_WIDTH) / numDays;
      const dayIndex = Math.floor((x - HORA_COL_WIDTH) / dayWidth);
      if (dayIndex < 0 || dayIndex >= numDays) return null; // Fuera del área de columnas

      // Calculate minutes from y position
      // (y / SLOT_HEIGHT) * SLOT_MINUTES: convierte píxeles a minutos.
      const minutesFromStart = (y / SLOT_HEIGHT) * SLOT_MINUTES;
      const totalMinutes = HOUR_START * 60 + minutesFromStart; // Sumamos el offset de HOUR_START

      // Snap to SNAP_MINUTES intervals
      // Math.round: redondea al múltiplo de SNAP_MINUTES más cercano.
      // Math.max/min: evita que la cita quede fuera del rango horario visible.
      const snapped = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
      const clamped = Math.max(HOUR_START * 60, Math.min(snapped, HOUR_END * 60));

      return { dayIndex, totalMinutes: clamped };
    },
    [numDays], // Solo recrea la función si cambia el número de columnas
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, apt: Appointment) => {
      if (!DRAGGABLE_STATUSES.has(apt.status?.toLowerCase())) return;
      if (!onAppointmentDragEnd) return;

      e.preventDefault();
      e.stopPropagation();

      const startMins = timeToMinutes(apt.startTime);
      const endMins = timeToMinutes(apt.endTime);
      const durationMinutes = endMins - startMins;

      const aptDay = dayjs(apt.startTime);
      // En vista día por empleado, fijamos la columna a la del empleado dueño.
      const originalDayIndex = viewMode === 'day' && dayEmployees.length > 0
        ? columns.findIndex((c) => c.employee?.id === apt.employeeId)
        : columns.findIndex((c) => c.date.isSame(aptDay, 'day'));

      setDragState({
        appointmentId: apt.id,
        appointment: apt,
        startX: e.clientX,
        startY: e.clientY,
        isDragging: false,
        ghostTop: ((startMins - HOUR_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT,
        ghostDayIndex: originalDayIndex >= 0 ? originalDayIndex : 0,
        ghostMinutes: startMins,
        originalDayIndex: originalDayIndex >= 0 ? originalDayIndex : 0,
        durationMinutes,
      });
    },
    [columns, viewMode, dayEmployees, onAppointmentDragEnd],
  );

  useEffect(() => {
    if (!dragState) return;

    function handleMouseMove(e: MouseEvent) {
      setDragState((prev) => {
        if (!prev) return null;

        const dx = e.clientX - prev.startX;
        const dy = e.clientY - prev.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!prev.isDragging && distance < 5) return prev;

        const slot = pixelToSlot(e.clientX, e.clientY);
        if (!slot) return { ...prev, isDragging: true };

        // Clamp so appointment doesn't extend past HOUR_END
        const maxStart = HOUR_END * 60 - prev.durationMinutes;
        const clampedMinutes = Math.min(slot.totalMinutes, maxStart);

        const ghostTop = ((clampedMinutes - HOUR_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;

        return {
          ...prev,
          isDragging: true,
          ghostTop,
          ghostDayIndex: slot.dayIndex,
          ghostMinutes: clampedMinutes,
        };
      });
    }

    function handleMouseUp() {
      setDragState((prev) => {
        if (!prev) return null;

        if (prev.isDragging && onAppointmentDragEnd) {
          // En vista día por empleado, las columnas representan empleados,
          // no días: el día destino siempre es `date`.
          const targetCol = columns[prev.ghostDayIndex];
          const newDay = targetCol?.date;
          if (newDay) {
            const closure = isDateInClosure(newDay, closures);
            if (!closure) {
              // Construir el datetime en zona LOCAL del usuario y convertir a
              // ISO con Z. Antes mandabamos "YYYY-MM-DDTHH:mm:00" sin offset
              // y el backend lo interpretaba como UTC, lo que causaba desfase
              // de horas igual al offset local.
              const hh = Math.floor(prev.ghostMinutes / 60);
              const mm = prev.ghostMinutes % 60;
              const newStartTime = newDay
                .hour(hh)
                .minute(mm)
                .second(0)
                .millisecond(0)
                .toISOString();

              // Only call if actually changed
              const origMins = timeToMinutes(prev.appointment.startTime);
              const origDay = prev.originalDayIndex;
              if (prev.ghostMinutes !== origMins || prev.ghostDayIndex !== origDay) {
                onAppointmentDragEnd(prev.appointmentId, newStartTime);
              }
            }
          }
        } else if (!prev.isDragging) {
          // It was a click, not a drag
          onAppointmentClick(prev.appointment);
        }

        return null;
      });
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, pixelToSlot, columns, closures, onAppointmentDragEnd, onAppointmentClick]);

  // --- Slot click handler ---
  function handleSlotClick(e: React.MouseEvent<HTMLDivElement>) {
    if (dragState) return;
    const slot = pixelToSlot(e.clientX, e.clientY);
    if (!slot) return;

    const closure = closureByDay[slot.dayIndex];
    if (closure) return;

    const col = columns[slot.dayIndex];
    if (!col) return;
    const timeStr = minutesToTimeStr(slot.totalMinutes);
    onSlotClick(`${col.date.format('YYYY-MM-DD')}T${timeStr}:00`);
  }

  // ── Cálculos del layout del grid ─────────────────────────────────────────

  // Altura total del área scrollable: cuántos slots hay × altura de cada slot.
  // --- Grid body height ---
  const gridBodyHeight = TOTAL_SLOTS * SLOT_HEIGHT;

  // Posición y visibilidad del indicador de hora actual (línea roja).
  // showTimeIndicator: la hora actual está dentro del rango visible (6–22).
  // timeIndicatorTop: a cuántos píxeles del top debe estar la línea.
  // Fórmula: (minutos desde HOUR_START) / SLOT_MINUTES × SLOT_HEIGHT
  // --- Current time indicator position ---
  const showTimeIndicator = nowMinutes >= HOUR_START * 60 && nowMinutes <= HOUR_END * 60;
  const timeIndicatorTop = ((nowMinutes - HOUR_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;

  // ── Variables del render ──────────────────────────────────────────────────
  // --- Render ---
  const GAP = 3; // Espacio en píxeles entre bloques de cita en la misma columna

  // isEmployeeView: true si estamos en vista día con columnas por empleado.
  // .some((c) => !!c.employee): devuelve true si alguna columna tiene empleado.
  // Vista día con columnas por empleado: scroll horizontal + columna horas fija.
  // Usamos minmax(168px, 1fr) para que las columnas crezcan cuando hay pocos
  // empleados (llenan el viewport) y se queden en 168px cuando hay muchos
  // (forzando scroll horizontal en el contenedor padre).
  const isEmployeeView = viewMode === 'day' && columns.some((c) => !!c.employee);
  const gridTemplateColumns = isEmployeeView
    ? `${HORA_COL_WIDTH}px repeat(${numDays}, minmax(${EMPLOYEE_COL_WIDTH}px, 1fr))`
    : `${HORA_COL_WIDTH}px repeat(${numDays}, 1fr)`;
  const innerMinWidth = isEmployeeView
    ? `${HORA_COL_WIDTH + numDays * EMPLOYEE_COL_WIDTH}px`
    : undefined;
  // Estilos para fijar la columna de horas (sticky) cuando hay scroll horizontal.
  // zIndex 15 supera el z-10 de los bloques de cita: al scrollear, el contenido
  // desaparece DETRÁS de la columna de horas en vez de superponerse.
  const stickyColStyle: React.CSSProperties = isEmployeeView
    ? {
        position: 'sticky',
        left: 0,
        zIndex: 15,
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
      }
    : {};
  const stickyCornerStyle: React.CSSProperties = isEmployeeView
    ? {
        position: 'sticky',
        left: 0,
        zIndex: 16,
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
      }
    : {};

  // ── JSX: estructura del grid de calendario ───────────────────────────────
  // Estructura general:
  //   <div> flex-col (contenedor principal, altura completa)
  //     <div> header con nombres de días (fijo, no hace scroll vertical)
  //     <div> body scrollable (vertical siempre, horizontal en vista empleado)
  //       <div> área absoluta con líneas de la cuadrícula (pointer-events-none)
  //       <div> overlay clickable para crear citas
  //       <div>* overlays de cierre del negocio
  //       <div>* bloques de citas
  //       <div> fantasma de drag-and-drop
  //       <div> indicador de hora actual (línea roja)
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-surface)' }}>

      {/* ── HEADER DE DÍAS: nombres de columnas (Lun, Mar, …) o nombres de empleados ── */}
      {/* Day headers — scroll horizontal habilitado y sincronizado con el body */}
      <div
        ref={headerRef}
        className={`border-b ${isEmployeeView ? 'overflow-x-auto' : 'overflow-x-hidden'}`}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
        }}
      >
      {/* Grid CSS del header: columna de horas + N columnas de días/empleados. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns,
          minWidth: innerMinWidth,
        }}
      >
        {/* Celda vacía de la esquina superior izquierda (sobre la columna de horas). */}
        {/* Empty corner cell (sticky en vista empleado) */}
        <div className="py-2" style={stickyCornerStyle} />

        {/* Itera las columnas: pueden ser días (vista semana) o empleados (vista día).
            col.employee: si existe, es vista por empleado. Si no, es vista por día. */}
        {columns.map((col, i) => {
          const day = col.date;
          const closure = closureByDay[i];      // Cierre del negocio ese día
          const dayTimeOffs = timeOffsByDay[i]; // Permisos/ausencias ese día
          const hasTimeOffs = dayTimeOffs.length > 0 && !closure;
          // businessHoursByDow.get(day.day()): obtiene el horario del día de la semana.
          // day.day(): devuelve 0 (domingo) a 6 (sábado).
          const dayBh = businessHoursByDow.get(day.day());
          // isDayClosed: el día tiene un cierre o el horario dice que no está abierto.
          const isDayClosed = closure || (dayBh && !dayBh.isOpen);

          // ── Vista empleado: avatar + nombre del empleado ──
          // Vista día por empleado: header con avatar + nombre + número de citas
          if (col.employee) {
            const emp = col.employee;
            const empColor = emp.color || '#008080';
            // appointmentsByDay.get(i): citas asignadas a este empleado en la vista.
            const aptCount = (appointmentsByDay.get(i) || []).length;
            // ?.[0] ?? '': si firstName es null/undefined, usa cadena vacía.
            // .toUpperCase(): iniciales en mayúsculas.
            const initials = `${emp.firstName?.[0] ?? ''}${emp.lastName?.[0] ?? ''}`.toUpperCase();
            return (
              // Link: click en el header de empleado navega a su perfil de staff.
              <Link
                key={col.key}
                href={`/staff/${emp.id}`}
                className="flex items-center gap-2 px-2 md:px-3 py-2 border-l border-[var(--border)] min-w-0 hover:bg-[var(--bg-muted)] transition-colors"
                title={`Ver perfil de ${emp.firstName} ${emp.lastName}`}
              >
                {/* Avatar del empleado: foto o iniciales. */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 text-[11px] font-bold text-white"
                  style={{ backgroundColor: empColor }}
                >
                  {emp.avatarUrl ? (
                    // Si la URL es absoluta (comienza con 'http'), la usa directamente.
                    // Si es relativa, le agrega el API_URL del backend.
                    <img
                      src={emp.avatarUrl.startsWith('http') ? emp.avatarUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${emp.avatarUrl}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initials || '·'}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate text-[var(--text-primary)]">
                    {emp.firstName}
                  </p>
                  {/* Contador de citas: singular/plural según aptCount. */}
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {aptCount} {aptCount === 1 ? 'cita' : 'citas'}
                  </p>
                </div>
              </Link>
            );
          }

          // ── Vista normal (semana/día): encabezado de día ──
          // isClickable: en vista semana se puede hacer click para ir al día.
          // !!onDayHeaderClick: doble negación — convierte función a boolean.
          const isClickable = viewMode === 'week' && !!onDayHeaderClick;
          const isCurrent = isToday(day);
          return (
            <div
              key={col.key}
              // Accesibilidad: role="button" + tabIndex para navegación con teclado.
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              // onDayHeaderClick!(day): el ! afirma que la función no es undefined (TypeScript).
              onClick={isClickable ? () => onDayHeaderClick!(day) : undefined}
              // onKeyDown: permite activar el botón con Enter o Espacio (accesibilidad).
              onKeyDown={
                isClickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onDayHeaderClick!(day);
                      }
                    }
                  : undefined
              }
              className={`text-center py-2 border-l border-[var(--border)] relative group ${
                isDayClosed ? 'bg-[var(--bg-muted)]' : ''
              } ${isClickable ? 'cursor-pointer hover:bg-[var(--bg-muted)] transition-colors' : ''}`}
              // Fondo teal suave para el día de hoy (si no está cerrado).
              style={isCurrent && !isDayClosed ? { backgroundColor: 'var(--primary-tint)' } : undefined}
            >
              {/* Nombre corto del día: "lun", "mar", etc. .format('ddd'): dayjs format. */}
              <p className="text-xs uppercase text-[var(--text-secondary)]">
                {day.format('ddd')}
              </p>
              {/* Número del día del mes: gris si cerrado, teal si hoy, normal si otro. */}
              <p
                className={`text-lg font-semibold ${
                  isDayClosed
                    ? 'text-[var(--text-muted)]'
                    : isToday(day)
                      ? 'text-primary-600'
                      : 'text-[var(--text-primary)]'
                }`}
              >
                {day.format('D')}
              </p>
              {/* Etiqueta "Cerrado" si el negocio no trabaja ese día. */}
              {isDayClosed && (
                <p className="text-xs text-[var(--text-muted)] truncate px-1">Cerrado</p>
              )}
              {/* Puntos de color que indican permisos/ausencias de empleados ese día.
                  Solo aparece si hay ausencias Y el día no es cierre de negocio. */}
              {hasTimeOffs && (
                <>
                  {/* Fila de puntos de color (uno por ausencia, con el color del empleado). */}
                  <div className="flex justify-center gap-0.5 mt-0.5">
                    {dayTimeOffs.map((to) => (
                      <span
                        key={to.id}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: to.employee?.color || '#6b7280' }}
                      />
                    ))}
                  </div>
                  {/* Tooltip en hover: lista detallada de ausencias.
                      hidden group-hover:block: CSS trick — se muestra solo al hacer hover
                      sobre el div padre que tiene className="group". */}
                  {/* Tooltip on hover */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 hidden group-hover:block w-52">
                    <div className="bg-gray-900 text-white rounded-lg shadow-lg px-3 py-2 text-left">
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Permisos / Ausencias</p>
                      {dayTimeOffs.map((to) => {
                        const empColor = to.employee?.color || '#6b7280';
                        // .charAt(0).: primera inicial del apellido.
                        const empName = to.employee
                          ? `${to.employee.firstName} ${to.employee.lastName.charAt(0)}.`
                          : 'Empleado';
                        // .toTimeString().slice(0, 5): extrae "HH:MM" de la fecha completa.
                        const startH = new Date(to.startDatetime).toTimeString().slice(0, 5);
                        const endH = new Date(to.endDatetime).toTimeString().slice(0, 5);
                        return (
                          <div key={to.id} className="flex items-start gap-2 py-1">
                            <span
                              className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                              style={{ backgroundColor: empColor }}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate">{empName}</p>
                              <p className="text-[10px] text-gray-300">
                                {formatTime(startH)} - {formatTime(endH)}
                              </p>
                              {/* to.reason &&: solo muestra la razón si existe. */}
                              {to.reason && (
                                <p className="text-[10px] text-gray-400 truncate">{to.reason}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {/* ── BODY SCROLLABLE: cuadrícula con líneas + citas + overlays ─────── */}
      {/* Scrollable grid body — scroll vertical siempre, horizontal solo en vista empleado */}
      <div className={`flex-1 overflow-y-auto ${isEmployeeView ? 'overflow-x-auto' : ''}`} ref={gridBodyRef}>
        {/* Contenedor con la altura fija del área de horas (gridBodyHeight px).
            position:relative: permite posicionar citas con absolute. */}
        <div className="relative" style={{ height: gridBodyHeight, minWidth: innerMinWidth }}>

          {/* ── LÍNEAS DEL GRID (fondo, no interactivas) ──── */}
          {/* pointer-events-none: este div no captura clicks (los deja pasar al overlay de abajo). */}
          {/* Grid lines + time labels using CSS Grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              display: 'grid',
              gridTemplateColumns,
              gridTemplateRows: `repeat(${TOTAL_SLOTS}, ${SLOT_HEIGHT}px)`,
            }}
          >
            {/* Array.from({ length: TOTAL_SLOTS }): crea TOTAL_SLOTS elementos para iterar.
                slotIdx: índice del slot (0 = 6:00, 1 = 6:30, 2 = 7:00, etc.).
                isHourLine: true si el slot es el inicio de una hora exacta (vs media hora). */}
            {Array.from({ length: TOTAL_SLOTS }).map((_, slotIdx) => {
              const isHourLine = slotIdx % 2 === 0;
              // Calcula la hora que corresponde a este slot.
              const hour = HOUR_START + Math.floor(slotIdx / 2);
              return (
                // React.Fragment: agrupa múltiples elementos sin agregar un div extra al DOM.
                // key={slotIdx}: identificador único de la fila del grid.
                <React.Fragment key={slotIdx}>
                  {/* Celda de la columna de horas: muestra "6:00", "7:00", etc. en los slots pares.
                      gridRow/gridColumn: posicionamiento explícito en el CSS Grid. */}
                  {/* Time label cell — sticky en vista empleado */}
                  <div
                    className="relative pr-2 text-right"
                    style={{ gridRow: slotIdx + 1, gridColumn: 1, ...stickyColStyle }}
                  >
                    {/* Solo muestra la etiqueta en slots de hora exacta (isHourLine).
                        slotIdx === 0 ? 'top-1' : '-top-2': el primer slot se alinea hacia abajo,
                        los demás se elevan para que el texto quede sobre la línea. */}
                    {isHourLine && (
                      <span className={`text-xs text-[var(--text-muted)] absolute right-2 ${slotIdx === 0 ? 'top-1' : '-top-2'}`}>
                        {formatHourLabel(hour)}
                      </span>
                    )}
                  </div>

                  {/* Celdas de los días: una por columna en esta fila del grid.
                      isDisabled: slot fuera del horario de trabajo → fondo sutil.
                      border-dashed en media hora, sólido en hora exacta. */}
                  {/* Day cells with grid lines */}
                  {columns.map((col, dayIdx) => {
                    const day = col.date;
                    const dow = day.day(); // Día de la semana (0=domingo, 6=sábado)
                    const bh = businessHoursByDow.get(dow);
                    const isClosed = bh ? !bh.isOpen : false;
                    // slotMinutes: minutos absolutos del inicio del slot (desde medianoche).
                    const slotMinutes = HOUR_START * 60 + slotIdx * SLOT_MINUTES;
                    // isOutsideHours: el slot está antes de la apertura o después del cierre.
                    const isOutsideHours = bh && bh.isOpen ? (slotMinutes < bh.start || slotMinutes >= bh.end) : false;
                    const isDisabled = isClosed || isOutsideHours;
                    return (
                      <div
                        key={dayIdx}
                        className={`border-l border-[var(--border)] ${
                          isHourLine
                            ? 'border-t border-t-[var(--border)]'           // Línea sólida en hora exacta
                            : 'border-t border-t-[var(--border)] border-dashed' // Punteada en media hora
                        } ${isDisabled ? 'bg-[var(--bg-subtle)]' : ''}`}
                        // gridColumn: dayIdx + 2 porque la columna 1 es para las horas.
                        style={{ gridRow: slotIdx + 1, gridColumn: dayIdx + 2 }}
                      />
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>

          {/* ── OVERLAY CLICKABLE: captura clicks para crear citas ──── */}
          {/* Cubre todo el área del grid excepto la columna de horas (left: HORA_COL_WIDTH).
              Al hacer click, llama a handleSlotClick que calcula el slot y hora. */}
          {/* Clickable overlay for creating appointments */}
          <div
            className="absolute inset-0"
            style={{ left: HORA_COL_WIDTH, cursor: 'pointer' }}
            onClick={handleSlotClick}
          />

          {/* ── OVERLAYS DE CIERRE: semitransparente sobre días cerrados ──── */}
          {/* columns.map: itera las columnas. Si closureByDay[i] es null, no renderiza nada.
              Posicionamiento: left = HORA_COL_WIDTH + dayIdx × (ancho de columna).
              La fórmula CSS calc() permite mezclar px y % en la misma expresión. */}
          {/* Closure overlays */}
          {columns.map((_, dayIdx) => {
            const closure = closureByDay[dayIdx];
            if (!closure) return null;
            return (
              <div
                key={`closure-${dayIdx}`}
                className="absolute z-20 flex flex-col items-center justify-center pointer-events-none bg-[var(--bg-muted)]/80"
                style={{
                  top: 0,
                  height: gridBodyHeight,
                  left: `calc(${HORA_COL_WIDTH}px + ${dayIdx} * ((100% - ${HORA_COL_WIDTH}px) / ${numDays}))`,
                  width: `calc((100% - ${HORA_COL_WIDTH}px) / ${numDays})`,
                }}
              >
                {/* Ícono de candado + texto "Cerrado" + razón del cierre. */}
                <svg className="w-6 h-6 text-[var(--text-secondary)] mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-sm font-semibold text-[var(--text-secondary)]">Cerrado</span>
                <span className="text-xs text-[var(--text-muted)] mt-0.5 px-2 text-center">{closure.reason}</span>
              </div>
            );
          })}

          {/* ── BLOQUES DE CITAS: uno por cada appointment ──────────────── */}
          {/* Se itera primero por columna (dayIdx) y luego por cita (apt).
              Si el día tiene un cierre, no se renderizan sus citas. */}
          {/* Appointment blocks */}
          {columns.map((_, dayIdx) => {
            if (closureByDay[dayIdx]) return null;
            const dayApts = appointmentsByDay.get(dayIdx) || [];
            const layout = layoutsByDay.get(dayIdx) || new Map();

            return dayApts.map((apt) => {
              // Calcular posición y tamaño del bloque en el grid.
              const startMins = timeToMinutes(apt.startTime);
              const endMins = timeToMinutes(apt.endTime);
              const durationMins = endMins - startMins;

              // top: distancia desde el tope del área visible hasta el inicio de la cita.
              // Fórmula: (minutos desde HOUR_START) / SLOT_MINUTES × SLOT_HEIGHT
              const top = ((startMins - HOUR_START * 60) / SLOT_MINUTES) * SLOT_HEIGHT;
              // height: altura del bloque según la duración. Mínimo 18px para que sea visible.
              // - 2: margen para separación visual entre citas.
              const height = Math.max((durationMins / SLOT_MINUTES) * SLOT_HEIGHT - 2, 18);

              // layout.get(apt.id): posición calculada por computeOverlapLayout.
              // column: en qué sub-columna va esta cita (0, 1, 2...) si hay solapamiento.
              // totalColumns: cuántas sub-columnas hay en este grupo de solapadas.
              const info = layout.get(apt.id) || { column: 0, totalColumns: 1 };
              const { column: col, totalColumns: totalCols } = info;

              // Colores del bloque basados en el empleado y estado.
              const employeeColor = apt.employee?.color || '#008080';
              const rgb = hexToRgb(employeeColor);
              // rgba con alpha 0.12: fondo muy suave del color del empleado.
              const bgColor = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)` : 'rgba(0, 128, 128, 0.12)';
              const statusLower = apt.status?.toLowerCase() || '';
              const statusExtra = STATUS_DECORATIONS[statusLower] || '';    // Clases extra por estado
              const statusDotColor = STATUS_DOT_COLORS[statusLower] || '#9ca3af'; // Color del punto de estado

              // isDraggable: solo los estados CONFIRMED/PENDING pueden arrastrarse.
              const isDraggable = DRAGGABLE_STATUSES.has(statusLower);
              // isBeingDragged: esta cita específica está siendo arrastrada ahora mismo.
              const isBeingDragged = dragState?.appointmentId === apt.id && dragState?.isDragging;

              // Texto del servicio principal y cuántos adicionales hay.
              // apt.items?.[0]?.serviceNameSnapshot: nombre del primer servicio (snapshot = precio al momento de reservar).
              const serviceName = apt.items?.[0]?.serviceNameSnapshot || 'Servicio';
              const extraServices = (apt.items?.length || 1) - 1;
              // Si hay más de un servicio: "Corte +2", si no: "Corte".
              const serviceLabel = extraServices > 0 ? `${serviceName} +${extraServices}` : serviceName;

              // Nombres para mostrar en el bloque.
              const clientName = apt.client
                ? `${apt.client.firstName} ${apt.client.lastName}`
                : 'Cliente';
              // .charAt(0).: primera inicial del apellido del empleado.
              const empShort = apt.employee
                ? `${apt.employee.firstName} ${apt.employee.lastName.charAt(0)}.`
                : '';

              const startTimeStr = formatBookingTime(apt.startTime);
              const endTimeStr = formatBookingTime(apt.endTime);

              return (
                <div
                  key={apt.id}
                  className={`absolute rounded-lg border-l-[3px] px-2 py-0.5 overflow-hidden transition-shadow z-10 select-none ${statusExtra} ${
                    isBeingDragged ? 'opacity-40' : 'hover:shadow-md'
                  } ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                  style={{
                    top,
                    height,
                    // Posicionamiento horizontal: HORA_COL_WIDTH + offset de columna de día
                    //   + offset de sub-columna (por solapamiento) + GAP de separación.
                    // ((100% - HORA_COL_WIDTH) / numDays): ancho de cada columna de día.
                    // col * ... / totalCols: offset de la sub-columna dentro del grupo.
                    left: `calc(${HORA_COL_WIDTH}px + ${dayIdx} * ((100% - ${HORA_COL_WIDTH}px) / ${numDays}) + ${col} * ((100% - ${HORA_COL_WIDTH}px) / ${numDays}) / ${totalCols} + ${GAP}px)`,
                    // Ancho proporcional a 1/totalCols del ancho de la columna de día.
                    width: `calc(((100% - ${HORA_COL_WIDTH}px) / ${numDays}) / ${totalCols} - ${GAP * 2}px)`,
                    borderLeftColor: employeeColor,
                    backgroundColor: bgColor,
                  }}
                  // onMouseDown: inicia el drag si la cita es arrastrable.
                  onMouseDown={(e) => {
                    if (isDraggable && onAppointmentDragEnd) {
                      handleMouseDown(e, apt);
                    }
                  }}
                  // onClick: abre el modal de detalle solo si no es arrastrable.
                  // Si es arrastrable, el click se maneja en mouseUp (en el useEffect del drag).
                  // e.stopPropagation(): evita que el click llegue al overlay del grid (que crearía nueva cita).
                  onClick={(e) => {
                    if (!isDraggable || !onAppointmentDragEnd) {
                      e.stopPropagation();
                      onAppointmentClick(apt);
                    }
                    // For draggable appointments, click is handled in mouseUp
                  }}
                >
                  {/* Hora de inicio y fin en el color del empleado. */}
                  {/* Time in employee color */}
                  <p className="text-[10px] font-semibold leading-tight truncate" style={{ color: employeeColor }}>
                    {formatTime(startTimeStr)} - {formatTime(endTimeStr)}
                  </p>

                  {/* Nombre del cliente + punto de estado (color según el estado de la cita). */}
                  {/* Client name + status dot */}
                  <div className="flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: statusDotColor }}
                    />
                    <p className="text-xs font-bold truncate text-[var(--text-primary)]">
                      {clientName}
                    </p>
                  </div>

                  {/* Empleado y servicio: solo se muestra si el bloque tiene suficiente altura.
                      height > 42: equivale a citas de ~30 min o más.
                      empShort ? ' · ' : '': separador solo si hay nombre de empleado. */}
                  {/* Employee + service info (only if block tall enough) */}
                  {height > 42 && (
                    <p className="text-[10px] truncate text-[var(--text-secondary)] leading-tight">
                      {empShort}{empShort ? ' · ' : ''}{serviceLabel}
                    </p>
                  )}
                </div>
              );
            });
          })}

          {/* ── FANTASMA DE DRAG: muestra el destino mientras se arrastra ──── */}
          {/* dragState?.isDragging: solo visible mientras hay un arrastre activo. */}
          {/* Drag ghost */}
          {dragState?.isDragging && (
            <div
              className="absolute rounded-lg border-2 border-dashed z-40 pointer-events-none"
              style={{
                top: dragState.ghostTop,
                height: Math.max((dragState.durationMinutes / SLOT_MINUTES) * SLOT_HEIGHT - 2, 18),
                left: `calc(${HORA_COL_WIDTH}px + ${dragState.ghostDayIndex} * ((100% - ${HORA_COL_WIDTH}px) / ${numDays}) + ${GAP}px)`,
                width: `calc((100% - ${HORA_COL_WIDTH}px) / ${numDays} - ${GAP * 2}px)`,
                borderColor: 'rgba(59, 130, 246, 0.5)',    // Azul semitransparente
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                // Transición suave de posición (75ms) al mover el ratón.
                transition: 'top 75ms ease, left 75ms ease',
              }}
            >
              {/* Hora de destino mientras arrastra. */}
              <div className="px-2 py-1 text-xs font-semibold text-blue-600">
                {formatTime(minutesToTimeStr(dragState.ghostMinutes))}
              </div>
            </div>
          )}

          {/* ── INDICADOR DE HORA ACTUAL: línea roja horizontal ──────────── */}
          {/* showTimeIndicator: solo si la hora actual está entre HOUR_START y HOUR_END.
              todayIndex >= 0: la columna del día de hoy existe en el grid. */}
          {/* Current time indicator */}
          {showTimeIndicator && todayIndex >= 0 && (
            <div
              className="absolute z-30 pointer-events-none"
              style={{
                top: timeIndicatorTop,
                left: HORA_COL_WIDTH - 4,
                right: 0,
              }}
            >
              {/* Punto rojo a la izquierda — marca la hora actual */}
              <div
                className="absolute rounded-full bg-danger-600 shadow-sm"
                style={{
                  width: 10,
                  height: 10,
                  top: -4,
                  left: 0,
                }}
              />
              {/* Linea horizontal de la hora actual */}
              <div
                className="border-t-2 border-danger-600"
                style={{
                  marginLeft: 10,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

