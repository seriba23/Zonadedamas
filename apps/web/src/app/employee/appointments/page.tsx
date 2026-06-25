// ─── appointments/page.tsx — Lista de Citas del Empleado ─────────────────
//
// Esta página está en /employee/appointments y muestra TODAS las citas del
// empleado autenticado. Permite:
//   - Ver citas próximas, de hoy, o pasadas (pestañas).
//   - Buscar por nombre de cliente o servicio.
//   - Filtrar por estado y por tipo de servicio.
//   - Ver el detalle completo de una cita en un modal.
//   - Cerrar una cita (cobro + fotos) con el wizard paso a paso.
//   - Marcar al cliente como ausente (no-show).
//   - Crear una nueva cita.
//
// FLUJO DE DATOS:
// 1. Detectamos la pestaña activa (upcoming/today/past).
// 2. Calculamos el rango de fechas para esa pestaña.
// 3. Hacemos la petición al backend con ese rango.
// 4. Aplicamos filtros locales (búsqueda, estado, servicio).
// 5. Agrupamos por fecha y renderizamos.

'use client';
// 'use client' es obligatorio porque usamos hooks de React (useState, useMemo,
// useEffect) y de React Query que solo funcionan en el navegador.

import { useState, useMemo, useEffect } from 'react';
// useState  → estado local del componente (pestaña activa, búsqueda, etc.)
// useMemo   → memoriza el resultado de un cálculo para no repetirlo en cada render.
//             Solo lo recalcula cuando cambian sus dependencias.
// useEffect → ejecuta código cuando cambian ciertas variables (efectos secundarios).

import { useSearchParams } from 'next/navigation';
// useSearchParams → hook de Next.js para leer los parámetros de la URL.
// Ejemplo: en /employee/appointments?appointmentId=xyz, podemos leer "xyz".

import { useAuth } from '@/lib/hooks/use-auth';
// useAuth → hook para acceder al usuario autenticado (y su employeeId).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// useQuery     → hace peticiones GET y guarda en caché.
// useMutation  → hace peticiones POST/PUT/DELETE (acciones que MODIFICAN datos).
// useQueryClient → acceso al cliente de React Query para invalidar cachés
//                  (cuando marcamos una cita como completada, invalidamos la
//                   caché para que la lista se refresque automáticamente).

import { api } from '@/lib/api';
// api → cliente HTTP con JWT automático.

import { formatCurrency as rawFormatCurrency, resolveImageUrl } from '@/lib/utils';
// rawFormatCurrency → formatea montos (fallback sin moneda del usuario).
// resolveImageUrl   → construye la URL completa de una imagen del servidor.

import { useCurrency } from '@/lib/hooks/use-currency';
// useCurrency → hook que devuelve la función format() con la moneda del usuario.

import dayjs from 'dayjs';
// dayjs → librería de fechas. Usamos dayjs.utc() para interpretar las fechas
// del servidor como UTC y evitar desfases horarios.

import { DatePicker } from '@/components/ui/date-picker';
// DatePicker → componente de selector de fechas (importado pero no usado
// directamente en el JSX visible, puede estar en el wizard).

import { CloseAppointmentWizard } from './close-wizard';
// CloseAppointmentWizard → wizard de 4-5 pasos para cerrar una cita
// (consentimiento foto, subir fotos, cobro, QR de confirmación).

import { AppointmentWizard } from '@/components/appointments/appointment-wizard';
// AppointmentWizard → wizard para CREAR una nueva cita (reutilizado del calendario).

import { formatBookingTime, formatBookingDay, formatBookingMonthShort, formatBookingWeekday } from '@/lib/booking-time';
// Funciones de formato de fecha para la tarjeta de cada cita:
//   formatBookingTime  → "3:30 PM"
//   formatBookingDay   → "17" (número del día)
//   formatBookingMonthShort → "JUN"
//   formatBookingWeekday   → "martes"

// ─── INTERFACES DE TIPOS ──────────────────────────────────────────────────
// Las interfaces describen la "forma" de los objetos que llegan del servidor.

interface AppointmentItem {
  serviceId: string;               // UUID del servicio
  serviceNameSnapshot: string;     // nombre del servicio en el momento de la reserva
  priceSnapshot: string | number;  // precio (puede venir como string desde la BD)
  durationSnapshot: number;        // duración en minutos
}

// ProductReservation: un producto físico reservado junto con la cita
// (ej: shampoo, tinte). Puede haber varios por cita.
interface ProductReservation {
  id: string;
  quantity: number;                              // cuántas unidades
  unitPrice: string | number;                    // precio por unidad
  product: { id: string; name: string; imageUrl: string | null };
}

// AppointmentRedemption: cupón/recompensa canjeado en esta cita.
interface AppointmentRedemption {
  id: string;
  code: string;
  reward: { name: string; type: string; discountAmount?: string | number; discountMode?: string };
}

// Appointment: objeto completo de una cita con todos sus sub-objetos.
interface Appointment {
  id: string;
  startTime: string;              // ISO 8601: "2026-03-15T10:00:00Z"
  endTime: string;
  status: string;                 // "PENDING", "CONFIRMED", "COMPLETED", etc.
  notes: string | null;           // notas opcionales
  photoConsent: boolean | null;   // ¿el cliente aceptó que se tomen fotos?
  discountAmount: string | number | null; // monto de descuento (cupón)
  /** Cita "deferred" enviada a la recepcion para cobrar via POS. */
  pendingPosPayment?: boolean;    // true si el empleado delegó el cobro a recepción
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    allergies?: string | null;    // alergias del cliente (IMPORTANTE para el servicio)
    user?: { avatarUrl?: string | null; allergies?: string | null } | null;
    // user → si el cliente tiene cuenta en el portal, aquí están sus datos adicionales
  };
  items: AppointmentItem[];              // servicios de la cita (puede ser varios)
  productReservations?: ProductReservation[]; // productos (opcional)
  redemption?: AppointmentRedemption | null;  // cupón canjeado (opcional)
}

// SectionTab: tipo de unión de literales para las 3 pestañas de la página.
// Solo puede ser exactamente uno de estos tres valores.
type SectionTab = 'upcoming' | 'past' | 'today';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  RESCHEDULED: { label: 'Reagendada', color: 'bg-orange-100 text-orange-800' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
  NO_SHOW: { label: 'Ausente', color: 'bg-gray-100 text-gray-800' },
};

// Estilo inline para badges (igual al de marketplace/appointments para
// consistencia visual entre vista cliente y vista empleado).
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#fef3c7', color: '#d97706' },
  CONFIRMED: { bg: '#d1fae5', color: '#059669' },
  RESCHEDULED: { bg: '#fed7aa', color: '#ea580c' },
  IN_PROGRESS: { bg: '#dbeafe', color: '#2563eb' },
  COMPLETED: { bg: '#f3f4f6', color: '#6b7280' },
  CANCELLED: { bg: '#fee2e2', color: '#dc2626' },
  NO_SHOW: { bg: '#fee2e2', color: '#dc2626' },
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  RESCHEDULED: 'Reagendada',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'Ausente',
};

// getDateRangeForSection: función utilitaria que, dado el nombre de la pestaña
// activa, devuelve el rango de fechas a usar para filtrar las citas.
// Así evitamos pedir TODAS las citas del historial completo (sería muy lento).
//
// PARÁMETRO: section → cuál pestaña está activa.
// RETORNA: objeto con startDate y endDate en formato 'YYYY-MM-DD'.
function getDateRangeForSection(section: SectionTab): { startDate: string; endDate: string } {
  const today = dayjs(); // momento actual

  // switch: evalúa 'section' y ejecuta el caso que coincide.
  switch (section) {
    case 'today':
      // Solo hoy: startDate = endDate = hoy.
      return { startDate: today.format('YYYY-MM-DD'), endDate: today.format('YYYY-MM-DD') };
    case 'upcoming':
      // Próximas 6 semanas. Suficiente para ver agenda futura sin overhead.
      // .add(42, 'day') → suma 42 días al día actual (6 semanas).
      return { startDate: today.format('YYYY-MM-DD'), endDate: today.add(42, 'day').format('YYYY-MM-DD') };
    case 'past':
      // Últimos 90 días. Historial reciente para reseñas/cobros pendientes.
      // .subtract(90, 'day') → resta 90 días al día actual.
      return { startDate: today.subtract(90, 'day').format('YYYY-MM-DD'), endDate: today.format('YYYY-MM-DD') };
  }
}

export default function EmployeeAppointmentsPage() {
  const { user } = useAuth();
  const currencyHook = useCurrency();
  const formatCurrency = currencyHook?.format ?? rawFormatCurrency;

  // queryClient: referencia al cliente de React Query. Lo usamos para
  // invalidar cachés manualmente después de mutaciones (ej: tras completar
  // una cita, invalidamos la lista para que se refresque).
  const queryClient = useQueryClient();

  // section: pestaña activa. Empieza en 'upcoming' (citas próximas).
  // <SectionTab> es la anotación de tipo TypeScript: solo puede ser
  // 'upcoming', 'past' o 'today'.
  const [section, setSection] = useState<SectionTab>('upcoming');

  // search: texto que el usuario escribe en el buscador.
  const [search, setSearch] = useState('');

  // statusFilter: estado seleccionado en el dropdown. '' = todos los estados.
  const [statusFilter, setStatusFilter] = useState<string>(''); // '' = todos

  // serviceFilter: nombre del servicio seleccionado. '' = todos los servicios.
  const [serviceFilter, setServiceFilter] = useState<string>('');

  // showNewWizard: controla si el wizard de "Nueva cita" está abierto.
  const [showNewWizard, setShowNewWizard] = useState(false);

  // selectedApt: la cita seleccionada para ver su detalle en el modal.
  // null = ninguna cita seleccionada (modal cerrado).
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);

  // wizardApt: la cita que se está cerrando con el CloseAppointmentWizard.
  // null = wizard de cierre cerrado.
  const [wizardApt, setWizardApt] = useState<Appointment | null>(null);

  // Calculamos el rango de fechas según la pestaña activa.
  // La desestructuración { startDate, endDate } extrae ambas propiedades
  // del objeto devuelto por getDateRangeForSection().
  const { startDate, endDate } = getDateRangeForSection(section);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['employee-appointments', user?.employeeId, startDate, endDate],
    queryFn: async () => {
      if (!user?.employeeId) return [];
      const res = await api.get<{ data: Appointment[] }>(
        `/api/appointments?employeeId=${user.employeeId}&startDate=${startDate}&endDate=${endDate}`,
      );
      return res.data;
    },
    enabled: !!user?.employeeId,
  });

  // Soporte de deep-link desde notificaciones: si llega ?appointmentId=
  // en la URL y la cita ya esta cargada, abre el detalle automaticamente.
  // Si la cita esta fuera del rango de la pestana actual (upcoming/today/
  // past), la traemos individual para abrir el modal igual.
  const searchParams = useSearchParams();
  const targetAptId = searchParams.get('appointmentId');
  const { data: deepLinkApt } = useQuery({
    queryKey: ['employee-appointment-detail', targetAptId],
    queryFn: async () => {
      if (!targetAptId) return null;
      try {
        const res = await api.get<{ data: Appointment }>(
          `/api/appointments/${targetAptId}`,
        );
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: !!targetAptId && !!user?.employeeId,
  });

  useEffect(() => {
    if (!targetAptId) return;
    const inList = (appointments || []).find((a) => a.id === targetAptId);
    if (inList) {
      setSelectedApt(inList);
    } else if (deepLinkApt) {
      setSelectedApt(deepLinkApt);
    }
  }, [targetAptId, appointments, deepLinkApt]);

  // completeMutation: marca una cita como COMPLETADA.
  // useMutation se usa para peticiones que MODIFICAN datos (POST, PUT, DELETE).
  // mutationFn: la función que hace la petición real. Recibe el id de la cita.
  // onSuccess: se ejecuta si la petición fue exitosa.
  //   - invalidateQueries → marca la caché como "obsoleta" para que React Query
  //     vuelva a pedir los datos actualizados al servidor automáticamente.
  //   - setSelectedApt(null) → cierra el modal de detalle.
  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/appointments/${id}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-appointments'] });
      setSelectedApt(null);
    },
  });

  // handleWizardDone: callback que se pasa al CloseAppointmentWizard.
  // Se ejecuta cuando el empleado termina todos los pasos del wizard.
  // opts?.awaitingReception → true si la cita fue enviada a recepción en vez
  // de completarse directamente (para que el cajero la cobre).
  const handleWizardDone = (opts?: { awaitingReception?: boolean }) => {
    queryClient.invalidateQueries({ queryKey: ['employee-appointments'] });
    queryClient.invalidateQueries({ queryKey: ['employee-appointment-detail'] });
    setWizardApt(null);
    // Tanto en el caso normal como en "enviado a recepcion" cerramos el
    // detalle: si quedo pendingPosPayment, el detalle no debe permitir
    // reabrir el wizard. El proximo refetch del listado mostrara el
    // nuevo estado de la cita.
    setSelectedApt(null);
    // opts.awaitingReception es informacion: si se necesita mostrar un
    // toast o similar a futuro, viene por aca.
    void opts; // void suprime la advertencia de TypeScript de "variable no usada"
  };

  // noShowMutation: marca al cliente como ausente (no se presentó a la cita).
  // Similar a completeMutation pero llama al endpoint /no-show.
  const noShowMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/appointments/${id}/no-show`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-appointments'] });
      setSelectedApt(null);
    },
  });

  // ─── FILTRADO Y ORDENAMIENTO ─────────────────────────────────────────────
  // useMemo: memoriza el resultado del cálculo. Solo se recalcula cuando
  // cambian las dependencias del arreglo al final: [appointments, section, ...].
  // Esto evita re-ejecutar el filtrado en cada render innecesario.
  //
  // Lista filtrada: por sección (próximas/pasadas), search, status y servicio.
  const sorted = useMemo(() => {
    const list = appointments || []; // si appointments es undefined, usamos []
    const now = dayjs();             // momento actual para comparar fechas
    // .trim() quita espacios. .toLowerCase() hace la búsqueda insensible a mayúsculas.
    const q = search.trim().toLowerCase();

    return list
      .filter((apt) => {
        // ── Filtro de sección ──
        // upcoming: solo citas activas (no canceladas/completadas/ausentes).
        // Incluye las que están en el futuro O las que están en curso.
        if (section === 'upcoming') {
          // dayjs.utc().isAfter(now) → la cita empieza después del momento actual
          const isFuture = dayjs.utc(apt.startTime).isAfter(now);
          // .includes() verifica si el estado está en el arreglo
          const isOpen = ['PENDING', 'CONFIRMED', 'RESCHEDULED', 'IN_PROGRESS'].includes(apt.status);
          // Si no es futura Y no está abierta, no la mostramos en "Próximas"
          if (!isFuture && !isOpen) return false;
          // Tampoco mostramos canceladas/completadas/ausentes en "Próximas"
          if (['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(apt.status)) return false;
        }
        // past: solo citas pasadas o cerradas (completadas, canceladas, ausentes).
        if (section === 'past') {
          const isPast = dayjs.utc(apt.startTime).isBefore(now);
          const isClosed = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(apt.status);
          // Si no es pasada Y no está cerrada, no la mostramos en "Pasadas"
          if (!isPast && !isClosed) return false;
        }
        // ── Filtro de búsqueda libre ──
        if (q) {
          // Recopilamos todos los campos buscables en un arreglo.
          // ...apt.items.map(...) → spread operator: "aplana" el arreglo de
          // nombres de servicios dentro de 'fields'.
          const fields = [
            apt.client.firstName,
            apt.client.lastName,
            apt.client.email,
            apt.client.phone,
            ...apt.items.map((i) => i.serviceNameSnapshot),
          ];
          // .some() devuelve true si AL MENOS UN elemento cumple la condición.
          // (f || '') → si f es null/undefined, usamos '' para evitar errores.
          // .includes(q) → verifica si el texto contiene lo que se busca.
          if (!fields.some((f) => (f || '').toLowerCase().includes(q))) return false;
        }
        // ── Filtro por estado ──
        // Solo filtra si statusFilter no está vacío. Si coincide el estado, pasa.
        if (statusFilter && apt.status !== statusFilter) return false;
        // ── Filtro por servicio ──
        // Solo filtra si serviceFilter no está vacío.
        // apt.items.some(...) → true si algún servicio de la cita coincide.
        if (serviceFilter && !apt.items.some((i) => i.serviceNameSnapshot === serviceFilter)) return false;
        // Si pasa todos los filtros, lo incluimos
        return true;
      })
      // Ordenamos la lista ya filtrada.
      // sort() recibe una función comparadora que devuelve:
      //   negativo → 'a' va antes que 'b'
      //   positivo → 'b' va antes que 'a'
      //   0 → igual orden
      .sort((a, b) => {
        const at = new Date(a.startTime).getTime(); // milisegundos del timestamp de 'a'
        const bt = new Date(b.startTime).getTime(); // milisegundos del timestamp de 'b'
        // upcoming: ascendente (la más próxima arriba = menor timestamp primero).
        // past/today: descendente (la más reciente arriba = mayor timestamp primero).
        return section === 'upcoming' ? at - bt : bt - at;
      });
  }, [appointments, section, search, statusFilter, serviceFilter]);
  // Las dependencias del useMemo: cada vez que cualquiera de estas variables
  // cambie, React recalcula 'sorted'.

  // serviceOptions: lista de nombres de servicios únicos para el dropdown.
  // useMemo para no recalcular en cada render.
  // new Set<string>() → estructura de datos que solo guarda valores únicos
  // (automáticamente elimina duplicados).
  const serviceOptions = useMemo(() => {
    const names = new Set<string>();
    // Por cada cita, por cada ítem, añadimos el nombre al Set.
    (appointments || []).forEach((a) => a.items.forEach((i) => names.add(i.serviceNameSnapshot)));
    // Array.from() convierte el Set en un arreglo.
    // .sort() lo ordena alfabéticamente.
    return Array.from(names).sort();
  }, [appointments]);

  // grouped: Map que agrupa las citas por fecha.
  // Map es una estructura clave→valor donde la clave es la fecha 'YYYY-MM-DD'
  // y el valor es el arreglo de citas de ese día.
  // Por ejemplo: { '2026-06-17': [cita1, cita2], '2026-06-18': [cita3] }
  const grouped = new Map<string, Appointment[]>();
  sorted.forEach((apt) => {
    const dateKey = dayjs.utc(apt.startTime).format('YYYY-MM-DD');
    // Si la fecha no existe en el Map, creamos un arreglo vacío para ella.
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    // Añadimos la cita al arreglo de esa fecha.
    // El ! al final de grouped.get(dateKey)! es el "non-null assertion":
    // le decimos a TypeScript que confiamos en que el valor no es undefined
    // (porque lo acabamos de crear si no existía).
    grouped.get(dateKey)!.push(apt);
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        {/* Header: titulo + CTA Nueva cita */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Mis Citas</h1>
          <button
            onClick={() => setShowNewWizard(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: '#008080' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nueva cita
          </button>
        </div>

        {/* Tabs sección: Próximas / Hoy / Pasadas — mismo estilo segmentado
            que /marketplace/appointments (rounded-lg + border, activo teal). */}
        <div className="flex rounded-lg border border-gray-300 overflow-hidden mb-3 max-w-md">
          {([
            { key: 'upcoming' as SectionTab, label: 'Próximas' },
            { key: 'today' as SectionTab, label: 'Hoy' },
            { key: 'past' as SectionTab, label: 'Pasadas' },
          ]).map((tab, idx) => (
            <button
              key={tab.key}
              onClick={() => setSection(tab.key)}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${idx > 0 ? 'border-l border-gray-300' : ''} ${
                section === tab.key
                  ? 'bg-[#008080] text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Buscador + filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente o servicio..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#008080]/30 focus:border-[#008080]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm rounded-xl border border-gray-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#008080]/30 focus:border-[#008080]"
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          {serviceOptions.length > 0 && (
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="text-sm rounded-xl border border-gray-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#008080]/30 focus:border-[#008080]"
            >
              <option value="">Todos los servicios</option>
              {serviceOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          {(search || statusFilter || serviceFilter) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setServiceFilter(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      {!isLoading && sorted.length > 0 && (
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span className="text-gray-500">
            {sorted.length} cita{sorted.length !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">
            {sorted.filter((a) => a.status === 'COMPLETED').length} completada{sorted.filter((a) => a.status === 'COMPLETED').length !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-300">|</span>
          <span className="font-medium text-gray-700">
            {formatCurrency(sorted.filter((a) => a.status === 'COMPLETED').reduce((s, a) => s + a.items.reduce((ss, i) => ss + Number(i.priceSnapshot), 0), 0))} generados
          </span>
        </div>
      )}

      <div>
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Cargando...</div>
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            {section === 'upcoming' && 'No tienes citas próximas'}
            {section === 'today' && 'No tienes citas para hoy'}
            {section === 'past' && 'No hay citas pasadas en este rango'}
          </div>
        ) : section === 'today' ? (
          <div className="space-y-3">
            {sorted.map((apt) => (
              <AppointmentRow
                key={apt.id}
                apt={apt}
                showDate={false}
                onClick={() => setSelectedApt(apt)}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {Array.from(grouped.entries()).map(([dateKey, apts]) => (
              <section key={dateKey}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                  {dayjs(dateKey).format('dddd, D [de] MMMM')}
                </p>
                <div className="space-y-3">
                  {apts.map((apt) => (
                    <AppointmentRow
                      key={apt.id}
                      apt={apt}
                      showDate={false}
                      onClick={() => setSelectedApt(apt)}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedApt && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
          onClick={() => setSelectedApt(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-900">Detalle de cita</h3>
                <button
                  onClick={() => setSelectedApt(null)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Status */}
              {(() => {
                const st = STATUS_LABELS[selectedApt.status] || STATUS_LABELS.PENDING;
                return (
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-4 ${st.color}`}>
                    {st.label}
                  </span>
                );
              })()}

              {/* Date/Time */}
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {dayjs.utc(selectedApt.startTime).format('dddd, D [de] MMMM YYYY')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {dayjs.utc(selectedApt.startTime).format('h:mm A')} - {dayjs.utc(selectedApt.endTime).format('h:mm A')}
                    </p>
                  </div>
                </div>

                {/* Client */}
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedApt.client.firstName} {selectedApt.client.lastName}
                    </p>
                    {selectedApt.client.phone && (
                      <p className="text-xs text-gray-500">{selectedApt.client.phone}</p>
                    )}
                    {selectedApt.client.email && (
                      <p className="text-xs text-gray-500">{selectedApt.client.email}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Alergias del cliente — visible solo si el cliente las
                  registro en su perfil del marketplace. Importante para el
                  empleado: evita reacciones alergicas al usar productos
                  durante el servicio. */}
              {(() => {
                const allergies = selectedApt.client.user?.allergies || selectedApt.client.allergies;
                if (!allergies || !allergies.trim()) return null;
                return (
                  <div className="mb-5 p-3 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-0.5">
                        Alergias del cliente
                      </p>
                      <p className="text-sm text-amber-900 break-words">{allergies}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Services + Products + Discount + Total */}
              {(() => {
                const servicesSubtotal = selectedApt.items.reduce(
                  (s, i) => s + Number(i.priceSnapshot),
                  0,
                );
                const products = selectedApt.productReservations || [];
                const productsSubtotal = products.reduce(
                  (s, p) => s + Number(p.unitPrice) * p.quantity,
                  0,
                );
                const discount = Number(selectedApt.discountAmount || 0);
                const total = Math.max(0, servicesSubtotal + productsSubtotal - discount);

                // Nombre del cupón si lo hay: del redemption o de las notas.
                const couponLabel = (() => {
                  if (selectedApt.redemption?.reward?.name) return selectedApt.redemption.reward.name;
                  const m = (selectedApt.notes || '').match(/\[Cup[oó]n: ([^\]]+)\]/);
                  if (m) return m[1];
                  const p = (selectedApt.notes || '').match(/\[Promoci[oó]n: ([^\]]+)\]/);
                  if (p) return p[1];
                  const r = (selectedApt.notes || '').match(/\[C[oó]digo 2x1: [^—]+— (?:Cup[oó]n|Promoci[oó]n): ([^\]]+)\]/);
                  if (r) return r[1];
                  return discount > 0 ? 'Cupón aplicado' : null;
                })();

                return (
                  <div className="border-t border-gray-100 pt-4 mb-4">
                    {/* Servicios */}
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Servicios</p>
                    {selectedApt.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5">
                        <div>
                          <p className="text-sm text-gray-700">{item.serviceNameSnapshot}</p>
                          <p className="text-xs text-gray-400">{item.durationSnapshot} min</p>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(Number(item.priceSnapshot))}
                        </span>
                      </div>
                    ))}

                    {/* Productos */}
                    {products.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-gray-500 mt-3 mb-2 uppercase">Productos</p>
                        {products.map((p) => (
                          <div key={p.id} className="flex items-center justify-between py-1.5">
                            <p className="text-sm text-gray-700">
                              {p.quantity}× {p.product.name}
                            </p>
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(Number(p.unitPrice) * p.quantity)}
                            </span>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Desglose */}
                    <div className="pt-3 mt-2 border-t border-gray-100 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Subtotal servicios</span>
                        <span className="text-xs text-gray-700">{formatCurrency(servicesSubtotal)}</span>
                      </div>
                      {productsSubtotal > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Subtotal productos</span>
                          <span className="text-xs text-gray-700">{formatCurrency(productsSubtotal)}</span>
                        </div>
                      )}
                      {discount > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-green-600 font-medium">
                            {couponLabel || 'Descuento'}
                          </span>
                          <span className="text-xs text-green-600 font-medium">
                            -{formatCurrency(discount)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-sm font-semibold text-gray-900">Total</span>
                        <span className="text-sm font-bold text-gray-900">
                          {formatCurrency(total)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Notes */}
              {selectedApt.notes && (
                <div className="border-t border-gray-100 pt-4 mb-4">
                  <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Notas</p>
                  <p className="text-sm text-gray-600">{selectedApt.notes}</p>
                </div>
              )}

              {/* Actions */}
              {['CONFIRMED', 'IN_PROGRESS'].includes(selectedApt.status) && (
                <div className="border-t border-gray-100 pt-4 flex gap-2">
                  {selectedApt.pendingPosPayment ? (
                    <div
                      className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-center border border-teal-200 bg-teal-50 text-[#008080]"
                      title="La cita ya fue enviada a recepcion. El cajero registrara el pago."
                    >
                      Esperando a recepción
                    </div>
                  ) : (
                    <button
                      onClick={() => setWizardApt(selectedApt)}
                      className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors"
                      style={{ backgroundColor: '#008080' }}
                    >
                      Cerrar cita
                    </button>
                  )}
                  <button
                    onClick={() => noShowMutation.mutate(selectedApt.id)}
                    disabled={noShowMutation.isPending}
                    className="py-2.5 px-4 text-sm font-medium border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Ausente
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Close Wizard */}
      {wizardApt && (
        <CloseAppointmentWizard
          appointment={wizardApt}
          onDone={handleWizardDone}
          onClose={() => setWizardApt(null)}
        />
      )}

      {/* Wizard de creación de nueva cita — reusa el wizard del calendario */}
      {showNewWizard && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <AppointmentWizard
            onClose={() => setShowNewWizard(false)}
            onSave={() => {
              queryClient.invalidateQueries({ queryKey: ['employee-appointments'] });
              setShowNewWizard(false);
            }}
            initialEmployeeId={user?.employeeId}
          />
        </div>
      )}
    </div>
  );
}

function AppointmentRow({
  apt,
  showDate,
  onClick,
  formatCurrency,
}: {
  apt: Appointment;
  showDate: boolean;
  onClick: () => void;
  formatCurrency: (amount: number) => string;
}) {
  const style = STATUS_STYLE[apt.status] || STATUS_STYLE.PENDING;
  const services = apt.items.map((i) => i.serviceNameSnapshot).join(', ') || '—';
  const servicesSubtotal = apt.items.reduce(
    (sum, i) => sum + Number(i.priceSnapshot),
    0,
  );
  const activeProducts = (apt.productReservations || []).filter((p) => p.status !== 'CANCELLED');
  const productsLabel = activeProducts
    .map((p) => (p.quantity > 1 ? `${p.quantity}× ${p.product.name}` : p.product.name))
    .join(', ');
  const productsSubtotal = activeProducts.reduce(
    (sum, p) => sum + Number(p.unitPrice) * p.quantity,
    0,
  );
  const discount = Number(apt.discountAmount || 0);
  const totalPrice = Math.max(0, servicesSubtotal + productsSubtotal - discount);
  const hasDiscount = discount > 0;

  // Avatar del cliente: foto si existe, fallback a iniciales sobre teal.
  // Si el cliente registró cuenta en el portal, su foto está en user.avatarUrl.
  const initials = `${apt.client.firstName?.[0] || ''}${apt.client.lastName?.[0] || ''}`.toUpperCase();
  const clientColor = '#008080';
  const clientAvatarUrl = resolveImageUrl(
    (apt.client as any).avatarUrl || (apt.client as any).user?.avatarUrl,
  );

  // Fecha desglosada (mismo formato que marketplace card).
  // No usamos new Date(...) porque convierte a TZ del browser. La hora
  // se muestra siempre como "hora del negocio" (raw).
  const day = formatBookingDay(apt.startTime);
  const month = formatBookingMonthShort(apt.startTime);
  const time = formatBookingTime(apt.startTime);
  const weekday = formatBookingWeekday(apt.startTime);

  // Nombre del cupón si lo hay (mismo fallback que el detalle)
  const couponLabel = (() => {
    if ((apt as any).redemption?.reward?.name) return (apt as any).redemption.reward.name;
    const notes = apt.notes || '';
    const m = notes.match(/\[Cup[oó]n: ([^\]]+)\]/);
    if (m) return m[1];
    const p = notes.match(/\[Promoci[oó]n: ([^\]]+)\]/);
    if (p) return p[1];
    const r = notes.match(/\[C[oó]digo 2x1: [^—]+— (?:Cup[oó]n|Promoci[oó]n): ([^\]]+)\]/);
    if (r) return r[1];
    return discount > 0 ? 'Cupón aplicado' : null;
  })();

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md transition-shadow"
    >
      {/* Header: nombre del cliente + status badge */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {apt.client.firstName} {apt.client.lastName}
        </p>
        <span
          className="px-2.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          {STATUS_LABEL[apt.status] || apt.status}
        </span>
      </div>

      {/* Main content */}
      <div className="flex items-center gap-3">
        {/* Avatar del cliente: foto si existe, fallback a iniciales */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0 ring-2 ring-white shadow"
          style={{ backgroundColor: clientColor }}
        >
          {clientAvatarUrl ? (
            <img src={clientAvatarUrl} alt="" className="w-full h-full object-cover" />
          ) : initials ? (
            initials
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
            </svg>
          )}
        </div>

        {/* Servicios + total */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 truncate">{services}</p>
          {productsLabel && (
            <p className="text-[11px] text-gray-400 truncate flex items-center gap-1 mt-0.5">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
              </svg>
              <span className="truncate">{productsLabel}</span>
            </p>
          )}
          <div className="flex items-baseline gap-2 mt-0.5">
            {hasDiscount && (
              <span className="text-[10px] text-gray-400 line-through leading-none">
                {formatCurrency(servicesSubtotal + productsSubtotal)}
              </span>
            )}
            <span className={`text-sm font-semibold ${hasDiscount ? 'text-green-600' : 'text-gray-900'}`}>
              {formatCurrency(totalPrice)}
            </span>
          </div>
        </div>

        {/* Fecha grande a la derecha */}
        <div className="flex-shrink-0 text-right">
          <p className="text-2xl font-bold text-gray-900 leading-none">{day}</p>
          <p className="text-[10px] font-semibold text-gray-400 uppercase">{month}</p>
          <p className="text-sm font-semibold mt-1" style={{ color: '#008080' }}>{time}</p>
          <p className="text-[10px] text-gray-400 capitalize">{weekday}</p>
        </div>
      </div>

      {/* Cupón aplicado */}
      {hasDiscount && (
        <div className="mt-3 flex items-center justify-between text-xs bg-green-50 rounded-lg px-3 py-2 border border-green-100">
          <span className="text-green-700 font-medium flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            </svg>
            {couponLabel}
          </span>
          <span className="text-green-700 font-bold">-{formatCurrency(discount)}</span>
        </div>
      )}
    </button>
  );
}
