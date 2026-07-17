// ============================================================
// PÁGINA: Mis citas y compras del marketplace
// RUTA:   /marketplace/appointments
//
// ¿Qué muestra?
//   - Dos pestañas: "Mis citas" y "Mis compras".
//   - Mis citas: lista de citas del cliente agrupadas en "Próximas" e "Historial".
//     Incluye buscador, filtros por estado/servicio/empleado y ordenamiento.
//   - Mis compras: lista de apartados de productos (reservas de tienda).
//   - Si una cita está COMPLETADA y no tiene reseña, el modal DualReviewModal
//     aparece automáticamente al cargar la página.
//   - Botón "Calificar" en tarjetas para abrir el modal de reseña manualmente.
// ============================================================
'use client';

// useState: variables reactivas. useEffect: efectos secundarios.
import { useState, useEffect } from 'react';
// useRouter: para navegar al detalle de cita al hacer click.
import { useRouter } from 'next/navigation';
// React Query para cargar citas y compras, y para la mutation de cancelar.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// Cliente HTTP del marketplace (con JWT).
import { marketplaceApi } from '@/lib/marketplace-api';
// Estado de autenticación del cliente marketplace.
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
// Utilidades de formato de moneda y fechas.
import { formatCurrency } from '@/lib/utils';
import { formatBookingTime, formatBookingDate, formatBookingDay, formatBookingMonthShort, formatBookingWeekday, isBookingUpcoming } from '@/lib/booking-time';
// Link: navegación SPA sin recarga completa.
import Link from 'next/link';
// Modal que permite calificar al empleado Y al negocio en un solo flujo.
import { DualReviewModal } from '@/components/ui/dual-review-modal';
import { AppointmentsCalendar } from '@/components/marketplace/appointments-calendar';
// Paginación por scroll (bloques de 30, sin botón "ver más").
import { useInfiniteScroll } from '@/lib/hooks/use-infinite-scroll';
import { SectionHelp } from '@/components/ui/section-help';

// URL base del backend.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TEAL = '#008080';

// ── Persistencia de reseñas descartadas ───────────────────
// Guardamos en localStorage los IDs de citas cuyo modal de reseña el cliente
// ya cerró sin calificar. Así el modal no vuelve a aparecer al regresar a la página.
// Sin localStorage, el estado vive solo en memoria y se pierde al desmontar el componente.
const REVIEW_DISMISS_KEY = 'siliba-review-dismissed';

// Devuelve el array de IDs descartados del localStorage.
// `typeof window === 'undefined'`: en Next.js el código también corre en el servidor
// (SSR), donde `window` no existe. Este check evita errores en el servidor.
function getDismissedReviews(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(REVIEW_DISMISS_KEY) || '[]');
  } catch {
    return [];
  }
}
function addDismissedReview(id: string) {
  if (typeof window === 'undefined' || !id) return;
  try {
    const cur = getDismissedReviews();
    if (!cur.includes(id)) {
      localStorage.setItem(REVIEW_DISMISS_KEY, JSON.stringify([...cur, id]));
    }
  } catch {
    /* localStorage lleno o bloqueado — no es crítico */
  }
}

// Diccionarios de traducción de estados: clave interna (inglés) → etiqueta en español.
// `Record<string, string>`: tipo TypeScript para objeto con claves y valores string.
const RESERVATION_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Apartado',
  CONFIRMED: 'Confirmado',
  READY: 'Listo para entrega',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const RESERVATION_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#fef3c7', color: '#d97706' },
  CONFIRMED: { bg: '#dbeafe', color: '#2563eb' },
  READY: { bg: '#ccfbf1', color: '#0d9488' },
  DELIVERED: { bg: '#d1fae5', color: '#059669' },
  CANCELLED: { bg: '#fee2e2', color: '#dc2626' },
};

const FULFILLMENT_LABELS: Record<string, string> = { PICKUP: 'Recoger en tienda física', SHIPPING: 'Envío a domicilio' };
const PAYMENT_LABELS: Record<string, string> = { CASH: 'Efectivo', SPEI: 'SPEI', CARD: 'Tarjeta' };

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'Ausente',
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#fef3c7', color: '#d97706' },
  CONFIRMED: { bg: '#d1fae5', color: '#059669' },
  IN_PROGRESS: { bg: '#dbeafe', color: '#2563eb' },
  COMPLETED: { bg: '#f3f4f6', color: '#6b7280' },
  CANCELLED: { bg: '#fee2e2', color: '#dc2626' },
  NO_SHOW: { bg: '#fee2e2', color: '#dc2626' },
};

function formatDate(dateStr: string) {
  return formatBookingDate(dateStr, 'weekday-short');
}

function formatTime(dateStr: string) {
  return formatBookingTime(dateStr);
}

// ── Componente principal ───────────────────────────────────
export default function MarketplaceAppointmentsPage() {
  const router = useRouter();

  // isAuthenticated: si el cliente tiene sesión activa.
  // isLoading (renombrado a authLoading): true mientras se verifica el token.
  const { isAuthenticated, isLoading: authLoading, activeProfile, profiles } = useMarketplaceAuth();

  // Pestaña activa: 'citas' o 'compras'. El tipo unión `'citas' | 'compras'`
  // limita los valores posibles (TypeScript detecta errores de tipeo).
  const [tab, setTab] = useState<'citas' | 'compras'>('citas');
  // Vista de las citas: tarjetas (lista) o calendario mensual.
  const [citasView, setCitasView] = useState<'tarjetas' | 'calendario'>('tarjetas');
  // Modo de la pestaña Citas: 'proximas' (futuras, incl. canceladas hasta que
  // pase su fecha) o 'registros' (todo lo que ya pasó: completadas, canceladas,
  // ausentes, perdidas).
  const [citasMode, setCitasMode] = useState<'proximas' | 'registros'>('proximas');
  // Modo de la pestaña Compras: 'mes' (solo las del mes corriente) o 'registros'
  // (todas las compras históricas).
  const [comprasMode, setComprasMode] = useState<'mes' | 'registros'>('mes');

  // Texto del buscador (filtra por nombre del servicio o negocio).
  const [search, setSearch] = useState('');

  // Filtro de estado: '' = todos. Ej: 'CONFIRMED', 'COMPLETED', 'CANCELLED'.
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Filtros adicionales para citas: '' = todos.
  const [serviceFilter, setServiceFilter] = useState<string>('');
  const [employeeFilter, setEmployeeFilter] = useState<string>('');
  // Filtro por perfil (solo en la vista familia del tutor): '' = todos.
  const [profileFilter, setProfileFilter] = useState<string>('');

  // Tipo unión para las opciones de ordenamiento. Se declara dentro del componente
  // para que TypeScript la conozca en todo el scope de la función.
  type SortKey = 'default' | 'recent' | 'oldest' | 'employee' | 'price';
  const [sortBy, setSortBy] = useState<SortKey>('default');

  // Controla si el bottom-sheet de filtros está visible.
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  // Opciones compartidas para los useQuery: caché de 30 segundos y sin refetch
  // automático al enfocar la ventana o al montar el componente. Evita múltiples
  // peticiones cuando el usuario alterna entre pestañas.
  // `as const`: dice a TypeScript que estos valores son literales exactos (no genéricos).
  const sharedQueryOpts = {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  } as const;

  // Carga las citas del cliente. Solo cuando está autenticado y en la pestaña 'citas'.
  // `enabled: isAuthenticated && tab === 'citas'`: React Query no pide datos hasta
  // que ambas condiciones sean verdaderas (evita peticiones sin token o innecesarias).
  // ¿El perfil activo es el del tutor (SELF)? Entonces mostramos la vista
  // FAMILIA: sus citas + las de sus hijos (cada una con un distintivo). Si el
  // activo es un hijo, solo las de ese hijo.
  const isSelfActive = activeProfile?.relationship === 'SELF';
  const apptProfileId = isSelfActive ? undefined : activeProfile?.id;

  // Mapa profileId → perfil (nombre, avatar, color) para distinguir de quién es
  // cada cita en la lista.
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  // Perfil dueño de una cita: lo mostramos (avatar coloreado + nombre) SOLO
  // cuando el usuario tiene más de un perfil (si solo tiene el suyo, no aporta).
  const profileFor = (appt: any) =>
    profiles.length > 1 && appt.client?.profileId
      ? profileById.get(appt.client.profileId) || null
      : null;

  // Color del punto en el calendario: el del perfil dueño de la cita (teal por
  // defecto). Siempre devuelve color, aunque solo haya un perfil.
  const dotColor = (appt: any) =>
    (appt.client?.profileId && profileById.get(appt.client.profileId)?.color) || TEAL;

  // El profileId va en la queryKey para que React Query recargue al cambiar de perfil.
  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-my-appointments', activeProfile?.id],
    queryFn: () =>
      marketplaceApi.get<{ data: any[] }>(
        `/my-appointments?filter=all&perPage=100${apptProfileId ? `&profileId=${apptProfileId}` : ''}`,
      ),
    enabled: isAuthenticated && tab === 'citas',
    ...sharedQueryOpts,
  });

  // Carga las compras (apartados de productos) del cliente. Solo en la pestaña 'compras'.
  // `{ data: purchasesData }`: desestructuración con renombre para evitar colisión
  // con la variable `data` de la query de citas.
  const { data: purchasesData, isLoading: purchasesLoading } = useQuery({
    queryKey: ['marketplace-my-purchases'],
    queryFn: () => marketplaceApi.get<{ data: any[] }>('/my-purchases'),
    enabled: isAuthenticated && tab === 'compras',
    ...sharedQueryOpts,
  });

  // Extraemos el array de citas y compras del envelope de la respuesta.
  // `|| []`: si no hay datos todavía, usamos array vacío para evitar errores.
  const appointments: any[] = (data as any)?.data || [];
  const purchases: any[] = (purchasesData as any)?.data || [];

  // Auto-pop reseña: al entrar a la sección de citas, si hay una COMPLETED
  // sin reseña, abrir el modal para que la deje. Solo una vez por sesión
  // de la página — si el usuario cierra el modal con "Omitir" no vuelve a
  // saltar en este montaje.
  const queryClient = useQueryClient();
  const [reviewTarget, setReviewTarget] = useState<any | null>(null);
  const [reviewDismissed, setReviewDismissed] = useState(false);
  useEffect(() => {
    if (reviewDismissed || reviewTarget || tab !== 'citas') return;
    // Buscamos la cita COMPLETED más reciente sin review, excluyendo las que el
    // cliente ya omitió antes (persistido en localStorage).
    // Exigimos también pago registrado: una cita meramente reservada
    // (CONFIRMED/PENDING) no tiene payments, por lo que aunque por error
    // estuviera en COMPLETED tampoco dispararía el modal.
    const dismissed = getDismissedReviews();
    const pending = appointments
      .filter(
        (a) =>
          a.status === 'COMPLETED' &&
          !a.review &&
          !a.reviewDismissedAt &&
          (a.payments || []).length > 0 &&
          !dismissed.includes(a.id),
      )
      .sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));
    if (pending.length > 0) setReviewTarget(pending[0]);
  }, [appointments, tab, reviewDismissed, reviewTarget]);

  const submitReviewMutation = useMutation({
    mutationFn: (payload: { rating: number; comment?: string; businessRating?: number; businessComment?: string }) =>
      marketplaceApi.post(`/my-appointments/${reviewTarget?.id}/review`, payload),
    onSuccess: () => {
      setReviewTarget(null);
      setReviewDismissed(true);
      queryClient.invalidateQueries({ queryKey: ['marketplace-my-appointments'] });
    },
    onError: (err: any) => alert(err?.message || 'No se pudo enviar la reseña'),
  });

  // ── Funciones de filtrado ──────────────────────────────────
  // q: texto de búsqueda normalizado (sin espacios extremos, en minúsculas).
  // `.toLowerCase()` permite que "Corte" encuentre "corte" y "CORTE".
  const q = search.trim().toLowerCase();
  const matchesAppointment = (a: any) => {
    if (!q) return true;
    const fields = [
      a.tenant?.name,
      a.employee?.firstName,
      a.employee?.lastName,
      ...(a.items || []).map((i: any) => i.serviceNameSnapshot),
    ];
    return fields.some((s: any) => (s || '').toLowerCase().includes(q));
  };
  const matchesPurchase = (p: any) => {
    if (!q) return true;
    const fields = [p.tenant?.name, p.product?.name, p.code];
    return fields.some((s: any) => (s || '').toLowerCase().includes(q));
  };

  // Filtro de status: si está vacío, deja pasar todo.
  // Los valores 'PAID' y 'UNPAID' son "virtuales" — filtran por
  // paymentProofUrl en vez de por status del lifecycle.
  const matchesAppointmentStatus = (a: any) => {
    if (!statusFilter) return true;
    if (statusFilter === 'PAID') return !!a.paymentProofUrl;
    if (statusFilter === 'UNPAID') return !a.paymentProofUrl;
    return a.status === statusFilter;
  };
  const matchesAppointmentService = (a: any) => {
    if (!serviceFilter) return true;
    return (a.items || []).some((i: any) => i.serviceNameSnapshot === serviceFilter);
  };
  const matchesAppointmentEmployee = (a: any) => {
    if (!employeeFilter) return true;
    return a.employee?.id === employeeFilter;
  };
  // Filtro por perfil: solo aplica en la vista familia (tutor/SELF activo),
  // donde están cargadas las citas de todos los perfiles. Si el activo es un
  // hijo, el backend ya filtró por él, así que aquí es no-op.
  const matchesAppointmentProfile = (a: any) => {
    if (!profileFilter || !isSelfActive) return true;
    return a.client?.profileId === profileFilter;
  };

  // Opciones para los filtros: extraídas dinámicamente de las citas cargadas.
  // `.flatMap()`: como `.map()` pero aplana un nivel. Cada cita tiene varios
  // items, y queremos un array plano con todos los nombres de servicio.
  // `new Set(...)`: elimina duplicados (ej: "Corte de cabello" aparece muchas veces).
  // `Array.from(...).sort()`: convierte el Set a array y lo ordena alfabéticamente.
  const serviceOptions = Array.from(
    new Set(appointments.flatMap((a) => (a.items || []).map((i: any) => i.serviceNameSnapshot)).filter(Boolean)),
  ).sort();
  const employeeOptionsMap = new Map<string, { id: string; name: string }>();
  for (const a of appointments) {
    if (a.employee?.id) {
      employeeOptionsMap.set(a.employee.id, {
        id: a.employee.id,
        name: `${a.employee.firstName || ''} ${a.employee.lastName || ''}`.trim() || 'Sin nombre',
      });
    }
  }
  const employeeOptions = Array.from(employeeOptionsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Total de una cita = suma de items.priceSnapshot.
  const apptTotal = (a: any) =>
    (a.items || []).reduce((sum: number, i: any) => sum + Number(i.priceSnapshot || 0), 0);

  // Helpers de comparacion. Strings raw (substring 0..19) evitan
  // convertir TZ del browser.
  const rawIso = (s: string | undefined) => (s || '').substring(0, 19);
  const tzFor = (a: any) => a?.location?.timezone || a?.tenant?.timezone || null;

  // Comparador segun sortBy. 'default' devuelve 0 para que la seccion
  // mantenga su orden natural (proximas asc, perdidas/historial desc).
  const sortComparator = (a: any, b: any) => {
    if (sortBy === 'recent') return rawIso(b.startTime).localeCompare(rawIso(a.startTime));
    if (sortBy === 'oldest') return rawIso(a.startTime).localeCompare(rawIso(b.startTime));
    if (sortBy === 'employee') {
      const an = `${a.employee?.firstName || ''} ${a.employee?.lastName || ''}`.trim();
      const bn = `${b.employee?.firstName || ''} ${b.employee?.lastName || ''}`.trim();
      return an.localeCompare(bn);
    }
    if (sortBy === 'price') return apptTotal(b) - apptTotal(a);
    return 0;
  };
  const matchesPurchaseStatus = (p: any) => {
    if (!statusFilter) return true;
    if (statusFilter === 'PAID') return !!p.paymentProofUrl;
    if (statusFilter === 'UNPAID') return !p.paymentProofUrl;
    return p.status === statusFilter;
  };

  // ── Agrupación de citas ────────────────────────────────────
  // Las citas se dividen en tres secciones según su estado y fecha:
  // - "Próximas": estado PENDING/CONFIRMED/IN_PROGRESS y fecha futura.
  // - "Perdidas": estado PENDING/CONFIRMED pero la fecha ya pasó.
  // - "Historial": estado COMPLETED/CANCELLED/NO_SHOW.
  // Aplicamos todos los filtros activos (buscador, estado, servicio, empleado).
  const filteredAppointments = appointments.filter((a) =>
    matchesAppointment(a) &&
    matchesAppointmentStatus(a) &&
    matchesAppointmentService(a) &&
    matchesAppointmentEmployee(a) &&
    matchesAppointmentProfile(a),
  );
  // Cuando hay sortBy explicito, ese gana sobre el default de la seccion.
  const upcomingDefaultSort = (a: any, b: any) => rawIso(a.startTime).localeCompare(rawIso(b.startTime));
  const recentDefaultSort = (a: any, b: any) => rawIso(b.startTime).localeCompare(rawIso(a.startTime));
  const useDefault = sortBy === 'default';
  // ── PRÓXIMAS vs REGISTROS — la división es por TIEMPO, no por estado ──
  // Una cita es "futura" si su fecha aún no ha pasado (o está en curso). Eso
  // incluye las canceladas cuya fecha todavía no llega (el cliente las ve hasta
  // que pasa su hora). Cuando la fecha pasa, la cita se mueve a "Registros".
  const isFutureAppt = (a: any) => isBookingUpcoming(a.startTime, tzFor(a)) || a.status === 'IN_PROGRESS';
  // Próximas: futuras (cualquier estado), ascendente (la más cercana primero).
  const proximas = filteredAppointments
    .filter(isFutureAppt)
    .sort(useDefault ? upcomingDefaultSort : sortComparator);
  // Registros: todo lo que ya pasó (completadas, canceladas, ausentes, perdidas),
  // descendente (lo más reciente primero).
  const registros = filteredAppointments
    .filter((a) => !isFutureAppt(a))
    .sort(useDefault ? recentDefaultSort : sortComparator);
  // Conjunto que se muestra según el modo activo.
  const currentSet = citasMode === 'registros' ? registros : proximas;
  const filteredPurchases = purchases.filter((p) => matchesPurchase(p) && matchesPurchaseStatus(p));

  // ── Compras: mes corriente vs. registros (todas) ───────────
  // Por defecto la pestaña Compras solo muestra las del mes en curso; el toggle
  // "Registros" revela todo el historial. Comparamos año+mes en hora local.
  const _now = new Date();
  const _curYM = _now.getFullYear() * 12 + _now.getMonth();
  const isCurrentMonthPurchase = (p: any) => {
    const d = new Date(p.createdAt);
    return d.getFullYear() * 12 + d.getMonth() === _curYM;
  };
  const currentPurchases =
    comprasMode === 'registros' ? filteredPurchases : filteredPurchases.filter(isCurrentMonthPurchase);

  // ── Scroll infinito (bloques de 30) ────────────────────────
  // Se llaman SIEMPRE (regla de hooks) antes de cualquier return temprano.
  const citasInfinite = useInfiniteScroll(
    currentSet,
    `citas-${citasMode}-${q}-${statusFilter}-${serviceFilter}-${employeeFilter}-${profileFilter}-${sortBy}`,
  );
  const comprasInfinite = useInfiniteScroll(
    currentPurchases,
    `compras-${comprasMode}-${q}-${statusFilter}`,
  );

  // Reseteamos filtro de status cuando cambias de tab (los sets son distintos)
  // Opciones por sección: la primera sección "Pago" usa valores virtuales
  // ('PAID' / 'UNPAID') basados en paymentProofUrl. La segunda sección
  // "Estado" usa los valores reales del lifecycle.
  const APPOINTMENT_STATUSES = [
    { value: 'CONFIRMED',   label: 'Confirmada' },
    { value: 'PENDING',     label: 'Pendiente' },
    { value: 'RESCHEDULED', label: 'Reprogramada' },
    { value: 'IN_PROGRESS', label: 'En progreso' },
    { value: 'COMPLETED',   label: 'Completada' },
    { value: 'CANCELLED',   label: 'Cancelada' },
    { value: 'NO_SHOW',     label: 'Ausente' },
  ];
  const PURCHASE_STATUSES = [
    { value: 'PENDING',   label: 'Apartado' },
    { value: 'CONFIRMED', label: 'Confirmado' },
    { value: 'READY',     label: 'Listo' },
    { value: 'DELIVERED', label: 'Entregado' },
    { value: 'CANCELLED', label: 'Cancelado' },
  ];
  const PAYMENT_FILTERS = [
    { value: 'UNPAID', label: 'Pago pendiente' },
    { value: 'PAID',   label: 'Pagado' },
  ];
  const statusOptions = tab === 'citas' ? APPOINTMENT_STATUSES : PURCHASE_STATUSES;

  // Mientras se verifica el token, no renderizamos nada (evita flash de UI incorrecta).
  if (authLoading) return null;

  // Si el usuario no está autenticado, mostramos pantalla de login.
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <p className="text-gray-500 text-sm">Inicia sesión para ver tus citas</p>
          <Link
            href="/marketplace/login"
            className="px-6 py-2.5 text-white rounded-full text-sm font-medium"
            style={{ backgroundColor: '#008080' }}
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header — search + filtros en un renglon, segmented control abajo.
          Sin titulo: el contexto ya queda claro por el tab y el bottom-nav. */}
      <div className="bg-gray-50 px-4 pt-3 pb-3 safe-top sticky top-0 z-30">
        <div className="max-w-2xl mx-auto">
          {/* Search + filtros + nueva cita en un renglon */}
          <div className="flex items-center gap-2 mb-2.5">
            {/* Ícono ⓘ de ayuda (esquina izquierda, compacto) */}
            <SectionHelp className="p-1.5 rounded-lg text-gray-400 hover:text-[#008080] hover:bg-gray-100 transition-colors flex-shrink-0" />
            <div className="relative flex-1 min-w-0">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === 'citas' ? 'Buscar cita, negocio, servicio...' : 'Buscar compra, producto, negocio...'}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:border-transparent"
                onFocus={(e) => { e.currentTarget.style.borderColor = TEAL; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0,128,128,0.25)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <button
              onClick={() => setShowFiltersSheet(true)}
              title="Filtros"
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 relative transition-colors"
              style={(statusFilter || serviceFilter || employeeFilter || profileFilter || sortBy !== 'default')
                ? { backgroundColor: TEAL, color: 'white', border: '1.5px solid ' + TEAL }
                : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
              }
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              {(statusFilter || serviceFilter || employeeFilter || profileFilter || sortBy !== 'default') && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-50" />
              )}
            </button>
            {/* Toggle calendario/lista: un solo icono. En lista muestra el icono
                de calendario (abre el popup); con el calendario abierto muestra
                el icono de lista (lo cierra y vuelve a las tarjetas). */}
            {tab === 'citas' && (
              <button
                onClick={() => setCitasView((v) => (v === 'calendario' ? 'tarjetas' : 'calendario'))}
                title={citasView === 'calendario' ? 'Ver lista' : 'Ver calendario'}
                aria-label={citasView === 'calendario' ? 'Ver lista' : 'Ver calendario'}
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                style={citasView === 'calendario'
                  ? { backgroundColor: TEAL, color: 'white', border: '1.5px solid ' + TEAL }
                  : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                }
              >
                {citasView === 'calendario' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                )}
              </button>
            )}
            {tab === 'citas' && (
              <button
                onClick={() => router.push('/marketplace')}
                title="Nueva cita"
                aria-label="Nueva cita"
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-colors"
                style={{ backgroundColor: TEAL, border: '1.5px solid ' + TEAL }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            )}
          </div>

          {/* Tabs Citas | Compras — cápsula redondeada estilo POS de administrador. */}
          <div className="flex justify-center">
            <div className="inline-flex p-1 rounded-full" style={{ backgroundColor: 'var(--soft-tint)' }}>
              <button
                onClick={() => { setTab('citas'); setStatusFilter(''); setServiceFilter(''); setEmployeeFilter(''); setProfileFilter(''); setSortBy('default'); setCitasMode('proximas'); setComprasMode('mes'); }}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-colors ${tab === 'citas' ? 'text-white' : 'text-[#5b6e6a]'}`}
                style={tab === 'citas' ? { backgroundColor: '#008080' } : {}}
              >
                Citas
              </button>
              <button
                onClick={() => { setTab('compras'); setStatusFilter(''); setServiceFilter(''); setEmployeeFilter(''); setProfileFilter(''); setSortBy('default'); setCitasMode('proximas'); setComprasMode('mes'); }}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-colors ${tab === 'compras' ? 'text-white' : 'text-[#5b6e6a]'}`}
                style={tab === 'compras' ? { backgroundColor: '#008080' } : {}}
              >
                Compras
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {tab === 'citas' ? (
          isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderBottomColor: TEAL }} />
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center gap-4">
              <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <p className="text-gray-500">No tienes citas todavía</p>
              <Link href="/marketplace" className="px-6 py-2.5 text-white rounded-full text-sm font-medium" style={{ backgroundColor: TEAL }}>
                Explorar negocios
              </Link>
            </div>
          ) : (
            <>
              {/* Encabezado del modo activo + icono toggle a la derecha.
                  En Próximas, el icono lleva a Registros; en Registros, regresa. */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  {citasMode === 'registros' ? 'Registros' : 'Próximas'}
                </h2>
                <button
                  type="button"
                  onClick={() => setCitasMode((m) => (m === 'registros' ? 'proximas' : 'registros'))}
                  title={citasMode === 'registros' ? 'Ver próximas' : 'Ver registros'}
                  aria-label={citasMode === 'registros' ? 'Ver próximas' : 'Ver registros'}
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                  style={citasMode === 'registros'
                    ? { backgroundColor: TEAL, color: 'white', border: '1.5px solid ' + TEAL }
                    : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                  }
                >
                  {/* Siempre el icono de registros; solo cambia el color activo/inactivo. */}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </button>
              </div>

              {currentSet.length === 0 ? (
                <div className="text-center py-16 flex flex-col items-center gap-4">
                  <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-gray-500">
                    {citasMode === 'registros' ? 'Aún no hay registros' : 'No tienes citas próximas'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {citasInfinite.visibleItems.map((appt) => (
                      <AppointmentCard key={appt.id} appt={appt} profile={profileFor(appt)} onPress={() => router.push(`/marketplace/appointments/${appt.id}`)} />
                    ))}
                  </div>
                  {/* Sentinel: al asomarse al final del scroll, revela 30 más. */}
                  {citasInfinite.hasMore && <div ref={citasInfinite.sentinelRef} className="h-10" />}
                </>
              )}
            </>
          )
        ) : (
          // ───── Compras tab ─────
          purchasesLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderBottomColor: TEAL }} />
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center gap-4">
              <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              <p className="text-gray-500">No has apartado productos todavía</p>
              <Link href="/marketplace?shop=1" className="px-6 py-2.5 text-white rounded-full text-sm font-medium" style={{ backgroundColor: TEAL }}>
                Explorar tiendas
              </Link>
            </div>
          ) : (
            <>
              {/* Encabezado del modo activo + icono toggle (mismo patrón que Citas).
                  El icono es siempre el de registros; solo cambia de color. */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  {comprasMode === 'registros' ? 'Registros' : 'Este mes'}
                </h2>
                <button
                  type="button"
                  onClick={() => setComprasMode((m) => (m === 'registros' ? 'mes' : 'registros'))}
                  title={comprasMode === 'registros' ? 'Ver este mes' : 'Ver registros'}
                  aria-label={comprasMode === 'registros' ? 'Ver este mes' : 'Ver registros'}
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                  style={comprasMode === 'registros'
                    ? { backgroundColor: TEAL, color: 'white', border: '1.5px solid ' + TEAL }
                    : { backgroundColor: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb' }
                  }
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </button>
              </div>

              {currentPurchases.length === 0 ? (
                <div className="text-center py-16 flex flex-col items-center gap-4">
                  <svg className="w-16 h-16 text-gray-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-gray-500">
                    {filteredPurchases.length === 0
                      ? 'Sin resultados para tu búsqueda'
                      : 'No tienes compras este mes'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {comprasInfinite.visibleItems.map((p) => (
                      <PurchaseCard key={p.id} purchase={p} onPress={() => router.push(`/marketplace/purchases/${p.id}`)} />
                    ))}
                  </div>
                  {comprasInfinite.hasMore && <div ref={comprasInfinite.sentinelRef} className="h-10" />}
                </>
              )}
            </>
          )
        )}
      </div>

      {/* Popup del calendario mensual. Se abre con el icono de calendario de la
          barra y se cierra con la X o tocando el fondo (vuelve a la lista). */}
      {tab === 'citas' && citasView === 'calendario' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setCitasView('tarjetas')} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">Calendario</h3>
              <button onClick={() => setCitasView('tarjetas')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-4 py-4 overflow-y-auto">
              <AppointmentsCalendar
                appointments={currentSet}
                colorOf={dotColor}
                renderList={(list) => (
                  <div className="space-y-3">
                    {list.map((appt) => (
                      <AppointmentCard key={appt.id} appt={appt} profile={profileFor(appt)} onPress={() => router.push(`/marketplace/appointments/${appt.id}`)} />
                    ))}
                  </div>
                )}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom sheet de filtros — mismo patron que /marketplace */}
      {showFiltersSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFiltersSheet(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-xl pb-safe">
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Filtros</h3>
              <button onClick={() => setShowFiltersSheet(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4">
              {(statusFilter || serviceFilter || employeeFilter || profileFilter || sortBy !== 'default') && (
                <button
                  onClick={() => { setStatusFilter(''); setServiceFilter(''); setEmployeeFilter(''); setProfileFilter(''); setSortBy('default'); setCitasMode('proximas'); setComprasMode('mes'); }}
                  className="w-full flex items-center justify-center gap-1.5 mb-4 py-2 rounded-xl text-xs font-medium border transition-colors"
                  style={{ color: '#dc2626', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  Limpiar filtros
                </button>
              )}
              {/* Filtro por perfil (vista familia del tutor): pastillas con el
                  color de cada perfil. Vive dentro de los filtros. */}
              {tab === 'citas' && isSelfActive && profiles.length > 1 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Perfil</p>
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    <button
                      onClick={() => setProfileFilter('')}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                      style={!profileFilter
                        ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                        : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                      }
                    >
                      Todos
                    </button>
                    {profiles.map((p) => {
                      const active = profileFilter === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setProfileFilter(p.id)}
                          className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5"
                          style={active
                            ? { backgroundColor: p.color || TEAL, color: 'white', borderColor: 'transparent' }
                            : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                          }
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active ? '#fff' : (p.color || TEAL) }} />
                          {p.firstName}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Pago</p>
              <div className="flex flex-wrap gap-1.5 mb-5">
                <button
                  onClick={() => { setStatusFilter(''); setShowFiltersSheet(false); }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                  style={!statusFilter
                    ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                    : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                  }
                >
                  Todos
                </button>
                {PAYMENT_FILTERS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setStatusFilter(opt.value); setShowFiltersSheet(false); }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={statusFilter === opt.value
                      ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                      : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Estado</p>
              <div className="flex flex-wrap gap-1.5">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setStatusFilter(opt.value); setShowFiltersSheet(false); }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style={statusFilter === opt.value
                      ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                      : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Nuevos filtros: solo aplican al tab de Citas y solo si hay
                 opciones disponibles en las citas cargadas. */}
              {tab === 'citas' && serviceOptions.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-5">Servicio</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setServiceFilter('')}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                      style={!serviceFilter
                        ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                        : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                      }
                    >
                      Todos
                    </button>
                    {serviceOptions.map((name) => (
                      <button
                        key={name}
                        onClick={() => setServiceFilter(name)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                        style={serviceFilter === name
                          ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                          : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                        }
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {tab === 'citas' && employeeOptions.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-5">Profesional</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setEmployeeFilter('')}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                      style={!employeeFilter
                        ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                        : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                      }
                    >
                      Todos
                    </button>
                    {employeeOptions.map((emp) => (
                      <button
                        key={emp.id}
                        onClick={() => setEmployeeFilter(emp.id)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                        style={employeeFilter === emp.id
                          ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                          : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                        }
                      >
                        {emp.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {tab === 'citas' && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-5">Ordenar por</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { value: 'default', label: 'Predeterminado' },
                      { value: 'recent', label: 'Más reciente' },
                      { value: 'oldest', label: 'Más antigua' },
                      { value: 'employee', label: 'Profesional (A-Z)' },
                      { value: 'price', label: 'Mayor monto' },
                    ] as { value: SortKey; label: string }[]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSortBy(opt.value)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                        style={sortBy === opt.value
                          ? { backgroundColor: TEAL, color: 'white', borderColor: TEAL }
                          : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="px-4 py-4" />
          </div>
        </div>
      )}

      {/* Modal de reseña — auto-abre al entrar si hay una cita COMPLETED
          sin review. El "Omitir" lo descarta hasta el próximo montaje. */}
      <DualReviewModal
        show={!!reviewTarget}
        employeeName={`${reviewTarget?.employee?.firstName || ''} ${reviewTarget?.employee?.lastName || ''}`.trim()}
        businessName={reviewTarget?.tenant?.name || ''}
        mode={reviewTarget?.tenant?.tenantType === 'FREELANCER' ? 'freelancer' : 'business'}
        appointment={reviewTarget ? (() => {
          const rt = reviewTarget;
          const cur = rt.tenant?.currency || 'MXN';
          const map = new Map<string, any>();
          for (const it of (rt.items || [])) if (it.employee?.id) map.set(it.employee.id, it.employee);
          if (map.size === 0 && rt.employee?.id) map.set(rt.employee.id, rt.employee);
          const professionals = Array.from(map.values()).map((e: any) => ({
            name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
            avatarUrl: e.avatarUrl ? `${API_URL}${e.avatarUrl}` : null,
            color: e.color,
          }));
          const pay = rt.payments?.[0];
          const lines: { label: string; value: string }[] = [];
          const disc = Number(pay?.discountAmount || rt.discountAmount || 0);
          const dep = Number(rt.depositPaid || 0);
          const tip = Number(pay?.tipAmount || 0);
          if (disc > 0) lines.push({ label: 'Descuento', value: `-${formatCurrency(disc, cur)}` });
          if (dep > 0) lines.push({ label: 'Anticipo', value: `-${formatCurrency(dep, cur)}` });
          if (tip > 0) lines.push({ label: 'Propina', value: formatCurrency(tip, cur) });
          return {
            services: (rt.items || []).map((i: any) => i.serviceNameSnapshot).join(', '),
            dateText: `${formatBookingDate(rt.startTime)}, ${formatBookingTime(rt.startTime)}`,
            professionals,
            payment: { total: pay ? formatCurrency(Number(pay.totalAmount || 0), cur) : undefined, lines },
          };
        })() : undefined}
        onSubmit={(payload) => submitReviewMutation.mutate(payload)}
        onSkip={() => {
          if (reviewTarget?.id) {
            // Persistencia permanente en el servidor (por cita) + respaldo
            // local por si no hay red. No bloqueamos el cierre del modal.
            addDismissedReview(reviewTarget.id);
            marketplaceApi
              .post(`/my-appointments/${reviewTarget.id}/dismiss-review`, {})
              .catch(() => {});
          }
          setReviewTarget(null);
          setReviewDismissed(true);
        }}
        isLoading={submitReviewMutation.isPending}
      />
    </div>
  );
}

function PurchaseCard({ purchase, onPress }: { purchase: any; onPress: () => void }) {
  const total = Number(purchase.unitPrice) * purchase.quantity + (Number(purchase.shippingCost) || 0);
  const currency = purchase.product?.currency || 'MXN';
  const day = formatBookingDay(purchase.createdAt);
  const month = formatBookingMonthShort(purchase.createdAt);

  const statusInfo = (() => {
    const map: Record<string, { text: string; bg: string; textColor: string; dot: string }> = {
      PENDING:   { text: 'Apartado',   bg: 'bg-yellow-50', textColor: 'text-yellow-700', dot: '#eab308' },
      CONFIRMED: { text: 'Confirmado', bg: 'bg-teal-50',   textColor: 'text-teal-700',   dot: '#008080' },
      READY:     { text: 'Listo',      bg: 'bg-blue-50',   textColor: 'text-blue-700',   dot: '#2563eb' },
      DELIVERED: { text: 'Entregado',  bg: 'bg-green-50',  textColor: 'text-green-700',  dot: '#059669' },
      CANCELLED: { text: 'Cancelado',  bg: 'bg-red-50',    textColor: 'text-red-700',    dot: '#dc2626' },
    };
    return map[purchase.status] || { text: purchase.status, bg: 'bg-gray-100', textColor: 'text-gray-600', dot: '#94a3b8' };
  })();

  return (
    <button
      onClick={onPress}
      className="w-full bg-white rounded-2xl border border-gray-200 p-3 text-left hover:bg-gray-50 transition-colors"
    >
      <div
        className="grid items-center gap-x-3 gap-y-1.5"
        style={{ gridTemplateColumns: 'auto auto 1fr auto' }}
      >
        <div className="row-span-2 self-center text-center min-w-[44px]">
          <p className="text-base font-bold leading-none tabular-nums" style={{ color: '#008080' }}>{day}</p>
          <p className="text-[9px] font-semibold uppercase text-gray-400 mt-0.5">{month}</p>
          {purchase.code && (
            <p className="text-[9px] font-mono text-gray-400 mt-1.5 leading-none">#{purchase.code}</p>
          )}
        </div>

        <div className="row-span-2 self-center w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center text-gray-300 shadow ring-1 ring-gray-100">
          {purchase.product?.imageUrl ? (
            <img src={`${API_URL}${purchase.product.imageUrl}`} alt={purchase.product.name} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159" />
            </svg>
          )}
        </div>

        <p className="text-sm md:text-base font-bold text-gray-900 truncate min-w-0">
          {purchase.product?.name}
        </p>

        <p className="text-xs md:text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap text-right">
          {formatCurrency(total, currency)}
        </p>

        <p
          className="text-xs text-gray-500 min-w-0 self-start leading-snug overflow-hidden"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            minHeight: 'calc(2 * 1.375em)',
          }}
        >
          {purchase.tenant?.name} · {purchase.quantity}× {FULFILLMENT_LABELS[purchase.fulfillmentType]}
        </p>

        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap self-start justify-self-end ${statusInfo.bg} ${statusInfo.textColor}`}>
          <span className="w-1 h-1 rounded-full" style={{ backgroundColor: statusInfo.dot }} />
          {statusInfo.text}
        </span>
      </div>

      {/* Indicador discreto de pago. Acciones (subir comprobante,
          WhatsApp, leyendas) viven en el detalle de la compra. */}
      <div className="mt-3 flex items-center justify-end text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: purchase.paymentProofUrl ? '#059669' : '#d1d5db' }}
          />
          {purchase.paymentProofUrl ? 'Pagado' : 'Pago pendiente'}
        </span>
      </div>
    </button>
  );
}


function AppointmentCard({ appt, onPress, profile }: { appt: any; onPress: () => void; profile?: any }) {
  const services = appt.items?.map((i: any) => i.serviceNameSnapshot).join(', ') || '—';
  const totalPrice = (appt.items || []).reduce((s: number, i: any) => s + Number(i.priceSnapshot || 0), 0);
  // Moneda del negocio. Si por alguna razón no viene, default a MXN
  // (NUNCA USD — el default global de formatCurrency confunde).
  const currency: string = appt.tenant?.currency || 'MXN';
  const empColor = appt.employee?.color || '#008080';
  const day = formatBookingDay(appt.startTime);
  const month = formatBookingMonthShort(appt.startTime);
  const time = formatBookingTime(appt.startTime);
  const endTime = formatBookingTime(appt.endTime);

  // Status: misma paleta que el dashboard admin (upcoming-appointments).
  const statusInfo = (() => {
    const map: Record<string, { text: string; bg: string; textColor: string; dot: string }> = {
      CONFIRMED:   { text: 'Confirmada',  bg: 'bg-teal-50',   textColor: 'text-teal-700',   dot: '#008080' },
      PENDING:     { text: 'Pendiente', bg: 'bg-yellow-50', textColor: 'text-yellow-700', dot: '#eab308' },
      RESCHEDULED: { text: 'Reprogramada', bg: 'bg-blue-50',  textColor: 'text-blue-700',   dot: '#2563eb' },
      IN_PROGRESS: { text: 'En progreso',    bg: 'bg-purple-50', textColor: 'text-purple-700', dot: '#7c3aed' },
      COMPLETED:   { text: 'Completada',  bg: 'bg-green-50',  textColor: 'text-green-700',  dot: '#059669' },
      CANCELLED:   { text: 'Cancelada',   bg: 'bg-red-50',    textColor: 'text-red-700',    dot: '#dc2626' },
      NO_SHOW:     { text: 'Ausente',     bg: 'bg-gray-100',  textColor: 'text-gray-600',   dot: '#94a3b8' },
    };
    return map[appt.status] || { text: appt.status, bg: 'bg-gray-100', textColor: 'text-gray-600', dot: '#94a3b8' };
  })();

  return (
    <button
      onClick={onPress}
      className="w-full bg-white rounded-2xl border border-gray-200 p-3 text-left hover:bg-gray-50 transition-colors"
    >
      {/* Grid 4 columnas: Hora/Fecha | Avatar | Título+precio | Servicio+status */}
      <div
        className="grid items-center gap-x-3 gap-y-1.5"
        style={{ gridTemplateColumns: 'auto auto 1fr auto' }}
      >
        {/* Col 1: fecha+hora — rowspan 2 */}
        <div className="row-span-2 self-center text-center min-w-[44px]">
          <p className="text-base font-bold leading-none tabular-nums" style={{ color: '#008080' }}>{day}</p>
          <p className="text-[9px] font-semibold uppercase text-gray-400 mt-0.5">{month}</p>
          <p className="text-xs font-semibold text-gray-700 tabular-nums mt-1.5 leading-none">{time}</p>
          {endTime && (
            <p className="text-[10px] text-gray-400 tabular-nums mt-0.5 leading-none">{endTime}</p>
          )}
        </div>

        {/* Col 2: avatar empleado — rowspan 2 */}
        <div
          className="row-span-2 self-center w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden ring-2 ring-white shadow"
          style={{ backgroundColor: empColor }}
        >
          {appt.employee?.avatarUrl ? (
            <img src={`${API_URL}${appt.employee.avatarUrl}`} alt="" className="w-full h-full object-cover" />
          ) : (
            <span>{appt.employee?.firstName?.[0]}{appt.employee?.lastName?.[0]}</span>
          )}
        </div>

        {/* Col 3 row 1: Negocio (+ distintivo del perfil si es de un hijo) */}
        <div className="min-w-0">
          <p className="text-sm md:text-base font-bold text-gray-900 truncate">
            {appt.tenant?.name || '—'}
          </p>
          {profile && (
            <span className="inline-flex items-center gap-1 mt-0.5">
              {/* Avatar coloreado del PERFIL (de quién es la cita: mamá/hijo). */}
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[7px] font-bold overflow-hidden flex-shrink-0"
                style={{ backgroundColor: profile.color || '#008080' }}
              >
                {profile.avatarUrl ? (
                  <img src={`${API_URL}${profile.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  (profile.firstName?.[0] || '').toUpperCase()
                )}
              </span>
              <span className="text-[10px] font-semibold" style={{ color: profile.color || '#008080' }}>
                {profile.firstName}
              </span>
            </span>
          )}
        </div>

        {/* Col 4 row 1: precio */}
        <p className="text-xs md:text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap text-right">
          {formatCurrency(totalPrice, currency)}
        </p>

        {/* Col 3 row 2: servicios + empleado */}
        <p
          className="text-xs text-gray-500 min-w-0 self-start leading-snug overflow-hidden"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            minHeight: 'calc(2 * 1.375em)',
          }}
        >
          {appt.serviceType === 'DOMICILIO' && (
            <span className="inline-flex items-center gap-0.5 mr-1 px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[9px] font-semibold align-middle">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
              </svg>
              Domicilio
            </span>
          )}
          {services}
          {appt.employee && (
            <span className="text-[10px] text-gray-400"> · {appt.employee.firstName} {appt.employee.lastName}</span>
          )}
        </p>

        {/* Col 4 row 2: status */}
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap self-start justify-self-end ${statusInfo.bg} ${statusInfo.textColor}`}>
          <span className="w-1 h-1 rounded-full" style={{ backgroundColor: statusInfo.dot }} />
          {statusInfo.text}
        </span>
      </div>

      {/* Cupón aplicado (puede venir de redemption por puntos o de promotion) */}
      {Number(appt.discountAmount) > 0 && (() => {
        // Nombre del cupón: si vino de redemption (puntos) usar reward.name.
        // Si no, intentar extraer "[Promoción: X]" de las notas. Fallback genérico.
        const fromRedemption = appt.redemption?.reward?.name;
        const fromNotes = (() => {
          const m = (appt.notes || '').match(/\[Promoci[oó]n: ([^\]]+)\]/);
          if (m) return m[1];
          const r = (appt.notes || '').match(/\[C[oó]digo 2x1: [^—]+— Promoci[oó]n: ([^\]]+)\]/);
          if (r) return r[1];
          return null;
        })();
        const label = fromRedemption || fromNotes || 'Cupón aplicado';
        return (
          <div className="mt-3 flex items-center justify-between text-xs bg-green-50 rounded-lg px-3 py-2 border border-green-100">
            <span className="text-green-700 font-medium flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              </svg>
              {label}
            </span>
            <span className="text-green-700 font-bold">-{formatCurrency(Number(appt.discountAmount), currency)}</span>
          </div>
        );
      })()}

      {/* Indicador discreto de pago + referencia. Las acciones (subir
          comprobante, WhatsApp) viven en el detalle de la cita. */}
      <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-gray-400">
        <span className="font-mono">#{(appt.id || '').substring(0, 8).toUpperCase()}</span>
        <span className="flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: appt.paymentProofUrl ? '#059669' : '#d1d5db' }}
          />
          {appt.paymentProofUrl ? 'Pagado' : 'Pago pendiente'}
        </span>
      </div>
    </button>
  );
}
