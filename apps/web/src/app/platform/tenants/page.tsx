// ============================================================
// ARCHIVO: apps/web/src/app/platform/tenants/page.tsx
// RUTA EN EL NAVEGADOR: /platform/tenants
//
// Página de gestión de CUENTAS (negocios/tenants) del Super Admin.
// Lista todos los negocios registrados en la plataforma con
// opciones de búsqueda, filtrado, paginación y acciones rápidas.
//
// ¿QUÉ MUESTRA?
// - Buscador de texto por nombre o email
// - Botón de filtros (abre modal): tipo de cuenta, estado, ordenamiento
// - Rejilla de tarjetas: una tarjeta por negocio
//   - Azul = Negocio (BUSINESS)
//   - Morado = Independiente (FREELANCER)
//   - Contacto directo: Email, WhatsApp, Teléfono
//   - Badge de estado + días restantes si está en TRIAL
//   - Menú de acciones (tres puntos): ver detalle / regalar meses / deshabilitar
// - Paginación
//
// ¿QUÉ HACE?
//   GET   /api/platform/tenants?page=&perPage=&search=&status=...
//   PATCH /api/platform/tenants/:id/status  → cambiar estado (ACTIVE/SUSPENDED)
//   POST  /api/platform/tenants/:id/grant-months → regalar meses de prueba
//
// CONCEPTOS ESPECIALES:
// - useSearchParams: lee parámetros de la URL actual (ej: ?status=TRIAL).
//   Se usa para pre-seleccionar el filtro cuando se llega desde el Dashboard.
// - Menú flotante (position: fixed): el menú de tres puntos usa coordenadas
//   absolutas de la pantalla para no quedarse recortado por overflow:hidden.
// - Modal "Regalar meses": permite dar N meses de prueba gratis a un negocio.
// ============================================================

// 'use client': usa hooks de React y del router → navegador.
'use client';

// useState: múltiples estados locales (lista, filtros, modales, menú).
// useEffect: para cargar datos y reagir a cambios de filtros.
// useCallback: para memorizar fetchTenants y evitar recreaciones.
import { useState, useEffect, useCallback } from 'react';

// Link: navegación sin recarga.
import Link from 'next/link';

// useSearchParams: lee los query params de la URL (ej: ?status=TRIAL).
// useRouter: para navegar programáticamente (al hacer clic en una tarjeta).
import { useSearchParams, useRouter } from 'next/navigation';

// platformApi: cliente HTTP del Super Admin.
import { platformApi } from '@/lib/platform-auth';

// Modal: componente de ventana emergente reutilizable.
import { Modal } from '@/components/ui/modal';

// resolveImageUrl: convierte una ruta relativa de imagen en URL absoluta del API.
import { resolveImageUrl } from '@/lib/utils';

// ─── TIPOS ───────────────────────────────────────────────

// Tenant: forma de cada negocio/cuenta que devuelve la API.
interface Tenant {
  id: string;
  name: string;              // Nombre del negocio (ej: "Salón María").
  slug: string;              // URL amigable (ej: "salon-maria").
  email: string;
  phone: string | null;
  businessType: string | null; // Rubro(s) separados por coma (ej: "SALON,SPA").
  tenantType: 'BUSINESS' | 'FREELANCER'; // Tipo de cuenta.
  createdAt: string;
  logoUrl: string | null;        // Foto de perfil (logo) del negocio.
  coverImageUrl: string | null;  // Foto de portada del negocio.
  // Respaldo para freelancer: las fotos de su ficha de empleado.
  employees?: { avatarUrl: string | null; coverImageUrl: string | null }[];
  subscription: {
    plan: string;
    status: string;            // TRIAL | ACTIVE | PAST_DUE | SUSPENDED | CANCELLED
    monthlyAmountUsd: string;  // Monto mensual en USD.
    nextBillingDate: string;   // Próxima fecha de cobro.
    trialEndsAt: string | null; // Fecha de fin del período de prueba.
  } | null;
  users?: { firstName: string; lastName: string }[]; // Usuarios del negocio (admin/dueño).
  _count: { users: number; employees: number; appointments: number }; // Contadores.
}

// Meta: metadatos de paginación.
interface Meta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// STATUS_LABELS: traduce códigos de estado a español legible.
const STATUS_LABELS: Record<string, string> = {
  TRIAL: 'Prueba', ACTIVE: 'Activo', PAST_DUE: 'Pago pendiente',
  SUSPENDED: 'Suspendido', CANCELLED: 'Cancelado',
};

// STATUS_BADGES: clases CSS para colorear los badges según estado.
const STATUS_BADGES: Record<string, string> = {
  TRIAL: 'bg-teal-100 text-teal-700',
  ACTIVE: 'bg-green-100 text-green-700',
  PAST_DUE: 'bg-amber-100 text-amber-700',
  SUSPENDED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
};

// BUSINESS_LABELS: traduce claves de tipo de negocio a nombres legibles.
const BUSINESS_LABELS: Record<string, string> = {
  SALON: 'Salón', BARBERIA: 'Barbería', SPA: 'Spa', CLINICA: 'Clínica', TATUAJES: 'Tatuajes',
};

// Componente principal de la página de Cuentas.
export default function TenantsPage() {
  // useSearchParams: lee los parámetros de la URL actual.
  // Ej: si se llegó desde /platform/dashboard haciendo clic en "En período de prueba",
  // la URL sería /platform/tenants?status=TRIAL y searchParams.get('status') → 'TRIAL'.
  const searchParams = useSearchParams();
  const router = useRouter(); // Para navegar al detalle al hacer clic en una tarjeta.

  // initialStatus: pre-selecciona el filtro de estado desde la URL.
  // searchParams.get('status') devuelve el valor o null; "|| ''" lo convierte a ''.
  const initialStatus = searchParams.get('status') || '';
  // initialNew: llega desde el KPI "Nuevos este mes" del dashboard (?new=month).
  const initialNew = searchParams.get('new') === 'month';

  // ── ESTADOS PRINCIPALES ────────────────────────────────
  const [tenants, setTenants] = useState<Tenant[]>([]);  // Lista de negocios cargados.
  const [meta, setMeta] = useState<Meta | null>(null);    // Paginación.
  const [loading, setLoading] = useState(true);           // Spinner de carga.

  // ── ESTADOS DE BÚSQUEDA Y FILTROS ─────────────────────
  const [search, setSearch] = useState('');               // Texto del buscador.
  const [filterStatus, setFilterStatus] = useState(initialStatus); // Estado de suscripción.
  const [filterNew, setFilterNew] = useState(initialNew);          // Solo nuevos de este mes.
  const [filterTenantType, setFilterTenantType] = useState('');    // BUSINESS | FREELANCER
  const [sortBy, setSortBy] = useState('');               // Criterio de ordenamiento.
  const [page, setPage] = useState(1);                    // Página actual.
  const [showFilters, setShowFilters] = useState(false);  // ¿Mostrar modal de filtros?

  // ── ESTADOS DEL MENÚ CONTEXTUAL (tres puntos) ─────────
  // menuOpenId: ID del negocio cuyo menú está abierto. null = ninguno.
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  // menuPos: posición en pantalla (coordenadas fijas) del menú flotante.
  // { top, right } en píxeles desde la esquina de la ventana.
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  // ── ESTADOS DEL MODAL "REGALAR MESES" ─────────────────
  // grantModal: null = cerrado. Si tiene valor, contiene los datos del modal:
  //   tenant: el negocio al que se le regalarán los meses
  //   months: cuántos meses regalar (1 por defecto)
  //   saving: true mientras se envía la petición
  //   error/success: mensajes de resultado
  const [grantModal, setGrantModal] = useState<{ tenant: Tenant; months: number; saving: boolean; error?: string; success?: string } | null>(null);

  // statusBusyId: ID del negocio que está procesando un cambio de estado.
  // Se usa para mostrar el spinner en el botón de ese negocio específico.
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────
  // openMenu: calcula la posición del menú contextual y lo abre.
  // Se ejecuta al hacer clic en el botón de tres puntos de una tarjeta.
  //
  // tenantId: ID del negocio cuyo menú se abre.
  // btn: el elemento HTMLButtonElement que recibió el clic.
  //      Se usa para obtener su posición en pantalla con getBoundingClientRect().
  function openMenu(tenantId: string, btn: HTMLButtonElement) {
    // getBoundingClientRect(): devuelve un objeto con top, bottom, left, right
    // de la posición del elemento relativa a la ventana del navegador.
    const rect = btn.getBoundingClientRect();
    const menuHeight = 180; // estimado: ver detalle + regalar meses + separador + habilitar/deshabilitar
    const menuWidth = 224; // w-56
    // spaceBelow: espacio disponible debajo del botón hasta el borde inferior de la ventana.
    const spaceBelow = window.innerHeight - rect.bottom;
    // placeAbove: si no hay suficiente espacio abajo, el menú aparece ARRIBA del botón.
    const placeAbove = spaceBelow < menuHeight + 16;
    setMenuPos({
      // Si placeAbove: posiciona encima del botón (rect.top - menuHeight - 4 px de margen).
      // Si no: posiciona justo debajo (rect.bottom + 4 px de margen).
      top: placeAbove ? rect.top - menuHeight - 4 : rect.bottom + 4,
      // right: distancia desde el lado derecho de la ventana al borde derecho del botón.
      // Math.max(8, ...): mínimo 8px del borde para no salirse de la pantalla.
      right: Math.max(8, window.innerWidth - rect.right),
    });
    setMenuOpenId(tenantId);
  }

  // closeMenu: cierra el menú contextual y borra la posición guardada.
  function closeMenu() {
    setMenuOpenId(null);
    setMenuPos(null);
  }

  // ── FUNCIÓN DE CARGA CON MEMOIZACIÓN ──────────────────
  // useCallback: evita que fetchTenants se recree en cada render.
  // Solo se recrea si cambia alguna de sus dependencias.
  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      // Construye la query string con todos los parámetros activos.
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', '15'); // 15 negocios por página.
      // Solo incluye el parámetro si tiene valor (evita ?search=&status=&...).
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (filterNew) params.set('new', 'month');
      if (filterTenantType) params.set('tenantType', filterTenantType);
      if (sortBy) params.set('sortBy', sortBy);

      const res = await platformApi.get<{ data: Tenant[]; meta: Meta }>(
        `/api/platform/tenants?${params.toString()}`,
      );
      setTenants(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  // Dependencias: la función cambia (y se re-ejecuta vía useEffect) cuando cambia alguna de estas.
  }, [page, search, filterStatus, filterNew, filterTenantType, sortBy]);

  // Carga los datos cada vez que fetchTenants cambia (o sea, cuando cambia page o algún filtro).
  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  // Cuando cambia cualquier filtro o la búsqueda, vuelve a la página 1.
  // Sin esto, podría quedar en página 5 con resultados de un filtro diferente.
  useEffect(() => { setPage(1); }, [search, filterStatus, filterNew, filterTenantType, sortBy]);

  // Click fuera cierra menú + recalcular si scroll/resize
  // EFECTO: cierra el menú al hacer clic fuera, al hacer scroll o redimensionar.
  useEffect(() => {
    // Si no hay menú abierto, no hace nada (el "return" temprano evita añadir listeners).
    if (!menuOpenId) return;
    const handler = () => closeMenu();
    // 'click': cualquier clic en la ventana cierra el menú.
    window.addEventListener('click', handler);
    // 'scroll' con { capture: true }: captura el scroll en cualquier elemento, no solo la raíz.
    window.addEventListener('scroll', handler, true);
    // 'resize': si cambia el tamaño, las coordenadas guardadas ya no son válidas.
    window.addEventListener('resize', handler);
    // La función de "limpieza" que devuelve useEffect se llama cuando:
    //   - el efecto se re-ejecuta (menuOpenId cambió)
    //   - el componente se desmonta
    // Elimina los listeners para evitar fugas de memoria.
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [menuOpenId]); // Se re-ejecuta solo cuando menuOpenId cambia.

  // daysUntilExpiry: calcula cuántos días faltan para que venza el período de prueba.
  // trialEndsAt: fecha de fin del trial (string ISO) o null si no aplica.
  // Devuelve el número de días (puede ser negativo si ya venció) o null.
  function daysUntilExpiry(trialEndsAt: string | null) {
    if (!trialEndsAt) return null;
    // new Date(trialEndsAt).getTime(): fecha de fin en milisegundos desde Epoch.
    // Date.now(): fecha actual en milisegundos.
    // / 86400000: divide por la cantidad de ms en un día (86400 segundos × 1000 ms).
    // Math.ceil: redondea hacia arriba (si quedan 0.5 días → 1 día).
    const days = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000);
    return days;
  }

  // handleQuickStatus: cambia el estado de un negocio directamente desde la lista.
  // t: el objeto Tenant a modificar.
  // status: el nuevo estado ('ACTIVE' o 'SUSPENDED').
  async function handleQuickStatus(t: Tenant, status: 'ACTIVE' | 'SUSPENDED') {
    setStatusBusyId(t.id); // Activa el spinner en el botón de ESTE negocio.
    closeMenu();            // Cierra el menú contextual.
    try {
      // PATCH al endpoint de cambio de estado.
      await platformApi.patch(`/api/platform/tenants/${t.id}/status`, { status });
      // Recarga la lista para reflejar el cambio.
      await fetchTenants();
    } catch (err) {
      console.error(err);
    } finally {
      setStatusBusyId(null); // Desactiva el spinner.
    }
  }

  // openGrantModal: abre el modal de "Regalar meses" para un negocio específico.
  // Inicializa el modal con 1 mes por defecto.
  function openGrantModal(t: Tenant) {
    closeMenu(); // Cierra el menú de tres puntos.
    setGrantModal({ tenant: t, months: 1, saving: false });
  }

  // submitGrantMonths: envía la petición de regalo de meses al backend.
  async function submitGrantMonths() {
    if (!grantModal) return; // Guarda de seguridad.
    // Actualiza el estado del modal para mostrar el spinner de carga.
    // Función actualizadora: recibe el estado previo (prev) y devuelve el nuevo.
    // "prev ? { ...prev, saving: true } : null": si prev es null, no cambia.
    // "{ ...prev }": spread operator, copia todas las propiedades de prev.
    setGrantModal((prev) => prev ? { ...prev, saving: true, error: undefined } : null);
    try {
      const res = await platformApi.post<{ data: { message: string; trialEndsAt: string } }>(
        `/api/platform/tenants/${grantModal.tenant.id}/grant-months`,
        { months: grantModal.months },
      );
      // Éxito: muestra el mensaje de confirmación del backend.
      setGrantModal((prev) => prev ? { ...prev, saving: false, success: res.data.message } : null);
      await fetchTenants(); // Recarga la lista para ver el nuevo estado.
    } catch (err: any) {
      // err?.response?.data?.message: el mensaje de error que devuelve el backend.
      // "?." = encadenamiento opcional: no explota si alguna propiedad no existe.
      // Cascada de "||": usa el primer valor no falsy.
      const msg = err?.response?.data?.message || err?.message || 'No se pudo regalar los meses';
      setGrantModal((prev) => prev ? { ...prev, saving: false, error: msg } : null);
    }
  }

  // ── RENDERIZADO ──────────────────────────────────────────
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Cuentas</h1>

      {/* Buscador + filtros */}
      {/* Barra de búsqueda libre y botón de filtros. */}
      <div className="flex items-center gap-2 mb-5">
        {/* Input con ícono de lupa a la izquierda y botón X cuando hay texto. */}
        <div className="relative flex-1">
          {/* Ícono de lupa, decorativo (pointer-events-none = no captura clics). */}
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {/* Campo de búsqueda. Cada letra escrita actualiza "search" → fetchTenants se re-ejecuta. */}
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]"
          />
          {/* Botón X: solo aparece si hay texto escrito. Limpia el buscador. */}
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Limpiar"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {/* Botón de filtros. Se pone teal si algún filtro está activo.
            "(filterTenantType || filterStatus || sortBy)": truthy si alguno no es ''. */}
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          aria-label="Filtros"
          className={`shrink-0 p-2.5 rounded-lg border transition-colors ${
            (filterTenantType || filterStatus || sortBy || filterNew)
              ? 'bg-[#008080] border-[#008080] text-white'  // Algún filtro activo
              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50' // Sin filtros
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      </div>

      {/* Modal de filtros */}
      {/* Modal con tres filtros: tipo de cuenta, estado y ordenamiento. */}
      {showFilters && (
        <Modal title="Filtros" onClose={() => setShowFilters(false)} size="sm">
          <div className="space-y-5">
            {/* Filtro: tipo de cuenta (Negocio vs Independiente). */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tipo de cuenta</label>
              <select value={filterTenantType} onChange={(e) => setFilterTenantType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]">
                <option value="">Todos los tipos</option>
                <option value="BUSINESS">Negocios</option>
                <option value="FREELANCER">Independientes</option>
              </select>
            </div>
            {/* Filtro: estado de suscripción. */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Estado</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]">
                <option value="">Todos los estados</option>
                <option value="TRIAL">En prueba</option>
                <option value="ACTIVE">Activo</option>
                <option value="PAST_DUE">Pago pendiente</option>
                <option value="SUSPENDED">Suspendido</option>
              </select>
            </div>
            {/* Filtro: criterio de ordenamiento. */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ordenar por</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008080]">
                <option value="">Más recientes</option>
                <option value="trial_expiry">Por vencimiento de prueba</option>
                <option value="name">Nombre A-Z</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              {/* Limpiar: resetea los tres filtros simultáneamente. */}
              <button onClick={() => { setFilterTenantType(''); setFilterStatus(''); setSortBy(''); setFilterNew(false); }}
                className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Limpiar
              </button>
              {/* Aplicar: cierra el modal (los filtros ya están aplicados en tiempo real). */}
              <button onClick={() => setShowFilters(false)}
                className="flex-1 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: '#008080' }}>
                Aplicar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Tarjetas — el color de la tarjeta indica el tipo de cuenta
          (independiente = morado, negocio = azul) en lugar de una etiqueta. */}
      {/* Renderizado condicional: cargando / sin resultados / rejilla de tarjetas. */}
      {loading ? (
        <div className="p-8 text-center text-gray-400">Cargando...</div>
      ) : tenants.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">No se encontraron cuentas</div>
      ) : (
        // Rejilla de tarjetas: 1 col en móvil, 2 en sm, 3 en xl.
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* .map() genera una tarjeta por cada negocio. "t" = tenant actual. */}
          {tenants.map((t) => {
            // days: días restantes del trial, o null si no está en trial.
            // "t.subscription?.trialEndsAt": acceso opcional (null safe).
            const days = t.subscription?.trialEndsAt ? daysUntilExpiry(t.subscription.trialEndsAt) : null;
            // isFreelancer: true si el negocio es de tipo FREELANCER.
            const isFreelancer = t.tenantType === 'FREELANCER';
            // typeCard: clases CSS del fondo y borde según el tipo de cuenta.
            const typeCard = isFreelancer
              ? 'bg-purple-50 border-purple-200 hover:border-purple-300' // Morado = independiente
              : 'bg-blue-50 border-blue-200 hover:border-blue-300';
            // accent: color principal para el círculo de ícono según tipo.
            // Morado (#7c3aed) para freelancer, azul (#2563eb) para negocio.
            const accent = isFreelancer ? '#7c3aed' : '#2563eb';
            // owner: primer usuario del arreglo de usuarios del tenant.
            // "t.users?.[0]": usa "?." para no fallar si users es undefined.
            // Es el propietario (Owner) del negocio.
            const owner = t.users?.[0];
            // Fotos: logo/portada del negocio; para freelancer, las de su ficha.
            const profilePhoto = resolveImageUrl(t.logoUrl || t.employees?.[0]?.avatarUrl);
            const coverPhoto = resolveImageUrl(t.coverImageUrl || t.employees?.[0]?.coverImageUrl);
            return (
              // Div tarjeta: al hacer clic navega al detalle del tenant.
              // "relative": necesario para que el botón de menú con "absolute" se posicione dentro.
              // `${typeCard}`: aplica las clases de color según el tipo (morado/azul).
              <div
                key={t.id}
                onClick={() => router.push(`/platform/tenants/${t.id}`)}
                className={`relative rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${typeCard}`}
              >
                {/* Botón de tres puntos (⋮) para abrir el menú de acciones.
                    Posicionado con "absolute top-3 right-3" dentro de la tarjeta.
                    "e.stopPropagation()": evita que el clic en el botón también
                    dispare el onClick del div padre (navegar al detalle). */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Toggle: si el menú ya está abierto para este tenant, lo cierra;
                    // si no, lo abre calculando la posición con openMenu().
                    if (menuOpenId === t.id) closeMenu();
                    else openMenu(t.id, e.currentTarget);
                  }}
                  // Desactivado mientras hay una operación de estado en curso
                  // para este tenant (evita doble clic durante la espera).
                  disabled={statusBusyId === t.id}
                  className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/70 text-gray-500 disabled:opacity-50"
                  aria-label="Acciones"
                >
                  {/* Ternario: si este tenant está ocupado (statusBusyId coincide),
                      muestra un spinner; si no, muestra el ícono de tres puntos. */}
                  {statusBusyId === t.id ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  )}
                </button>

                {/* Foto de PORTADA del negocio (edge-to-edge arriba de la tarjeta).
                    Si no hay portada, usamos el color de acento del tipo de cuenta. */}
                <div
                  className="-mx-4 -mt-4 mb-3 h-20 rounded-t-xl bg-cover bg-center"
                  style={coverPhoto ? { backgroundImage: `url(${coverPhoto})` } : { backgroundColor: accent }}
                />

                {/* Bloque de identidad: círculo con ícono + nombre del negocio + dueño.
                    "pr-8": padding derecho para no solaparse con el botón de menú. */}
                <div className="flex items-center gap-3 pr-8">
                  {/* Círculo de ícono: usa el color accent calculado arriba.
                      "style={{ backgroundColor: accent }}": color inline dinámico. */}
                  {/* Foto de PERFIL (logo del negocio o avatar del freelancer);
                      si no hay foto, mostramos el ícono según el tipo. Sube un
                      poco (-mt-9) para solaparse con la portada. */}
                  <div className="w-12 h-12 -mt-9 rounded-full ring-4 ring-white overflow-hidden flex items-center justify-center text-white shrink-0 shadow-sm" style={{ backgroundColor: accent }}>
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="" className="w-full h-full object-cover" />
                    ) : isFreelancer ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m6-14h1m-1 4h1m4-4h1m-1 4h1m-5 6h4v4h-4v-4z" />
                      </svg>
                    )}
                  </div>
                  {/* Bloque de texto: nombre y dueño con truncado para nombres largos.
                      "min-w-0": necesario para que "truncate" funcione en flex. */}
                  <div className="min-w-0 flex-1">
                    {/* Nombre del negocio. "truncate" corta con "..." si es muy largo. */}
                    <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                    {/* "owner &&": solo muestra el dueño si existe (renderizado condicional). */}
                    {owner && (
                      <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {/* Nombre completo del primer usuario (propietario). */}
                        {owner.firstName} {owner.lastName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Fila de botones de contacto con íconos pequeños.
                    "onClick={(e) => e.stopPropagation()": evita que el clic en el enlace
                    navegue al detalle del tenant (que es el comportamiento del div padre). */}
                <div className="flex items-center gap-2 mt-3">
                  {/* Botón de email: abre el cliente de correo con el email del tenant. */}
                  <a href={`mailto:${t.email}`} onClick={(e) => e.stopPropagation()} title={t.email}
                    className="w-8 h-8 rounded-lg border border-gray-200 bg-white/60 text-gray-500 hover:text-[#008080] flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </a>
                  {/* "t.phone &&": solo muestra los botones de teléfono si existe el número. */}
                  {t.phone && (
                    <>
                      {/* Enlace de WhatsApp. Lógica del href:
                          - replace(/\D/g, ''): elimina TODOS los caracteres que NO sean dígitos.
                            "/\D/g" = expresión regular: \D = no-dígito, /g = reemplaza todos.
                          - Si el número resultante tiene 10 dígitos (número mexicano sin código de país),
                            agrega "52" al inicio (código de país México).
                          - Si ya tiene más de 10 dígitos, lo usa tal cual.
                          Resultado: un número válido para wa.me (ej: "5215512345678").
                          "target='_blank'": abre en nueva pestaña.
                          "rel='noopener noreferrer'": seguridad para links externos. */}
                      <a href={`https://wa.me/${t.phone.replace(/\D/g, '').length === 10 ? '52' + t.phone.replace(/\D/g, '') : t.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title={`WhatsApp ${t.phone}`}
                        className="w-8 h-8 rounded-lg border border-gray-200 bg-white/60 text-gray-500 hover:text-green-600 flex items-center justify-center">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.748-.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                        </svg>
                      </a>
                      {/* Botón de llamada telefónica: abre el marcador con "tel:". */}
                      <a href={`tel:${t.phone}`} onClick={(e) => e.stopPropagation()} title={`Llamar ${t.phone}`}
                        className="w-8 h-8 rounded-lg border border-gray-200 bg-white/60 text-gray-500 hover:text-[#008080] flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </a>
                    </>
                  )}
                </div>

                {/* Pie de la tarjeta: rubro del negocio + badge de estado de suscripción.
                    "border-t": línea separadora superior.
                    "justify-between": distribuye rubro y badge en extremos opuestos. */}
                <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-200/70">
                  {/* Rubro(s) del negocio.
                      t.businessType: string con tipos separados por coma (ej: "SALON,SPA").
                      .split(','): convierte en arreglo ["SALON", "SPA"].
                      .map((bt) => BUSINESS_LABELS[bt] || bt): traduce cada código a español.
                      .join(', '): une de nuevo en un string "Salón, Spa".
                      Si no hay businessType, muestra "Sin rubro". */}
                  <span className="text-xs text-gray-600 truncate">
                    {t.businessType ? t.businessType.split(',').map((bt) => BUSINESS_LABELS[bt] || bt).join(', ') : 'Sin rubro'}
                  </span>
                  {/* "t.subscription &&": solo muestra el badge si existe la suscripción. */}
                  {t.subscription && (
                    <span className="shrink-0 text-right">
                      {/* Badge de estado: busca las clases en STATUS_BADGES.
                          "|| 'bg-gray-100'": fallback si el estado no está en el diccionario. */}
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_BADGES[t.subscription.status] || 'bg-gray-100'}`}>
                        {/* Nombre del estado en español, o el código crudo si no hay traducción. */}
                        {STATUS_LABELS[t.subscription.status] || t.subscription.status}
                      </span>
                      {/* Contador de días del trial: solo visible si el estado es TRIAL y days no es null.
                          "days !== null": distingue entre 0 días (vencido hoy) y null (no es trial). */}
                      {t.subscription.status === 'TRIAL' && days !== null && (
                        // Texto rojo si quedan 5 días o menos; gris si quedan más.
                        <span className={`block text-[10px] mt-0.5 ${days <= 5 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                          {/* Ternario: si days > 0 muestra "X días", si no muestra "Vencido". */}
                          {days > 0 ? `${days} días` : 'Vencido'}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginación: solo visible si hay más de una página de resultados. */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">{meta.total} cuentas totales</p>
          <div className="flex gap-2">
            {/* Math.max(1, p - 1): nunca baja de la página 1. */}
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Anterior</button>
            <span className="px-3 py-1 text-sm text-gray-600">{page} / {meta.totalPages}</span>
            {/* Math.min(meta.totalPages, p + 1): nunca supera el total de páginas. */}
            <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50">Siguiente</button>
          </div>
        </div>
      )}

      {/* ── MENÚ FLOTANTE DE ACCIONES ────────────────────────────────────────
          Este menú usa "position: fixed" y coordenadas calculadas por openMenu()
          para aparecer junto al botón de tres puntos que lo disparó.
          Se renderiza FUERA del flujo normal de las tarjetas (portal conceptual)
          para no quedar cortado por el overflow o z-index de los contenedores.

          "menuOpenId && menuPos": ambas condiciones deben ser verdaderas para mostrar.
          "(() => { ... })()": función auto-invocada (IIFE) que permite hacer lógica
          (buscar el tenant, calcular isSuspended) antes del return del JSX. */}
      {menuOpenId && menuPos && (() => {
        // Busca el tenant cuyo menú está abierto en el arreglo de tenants.
        const t = tenants.find((x) => x.id === menuOpenId);
        // Si por algún motivo no se encuentra, no renderiza nada.
        if (!t) return null;
        // isSuspended: true si la cuenta ya está deshabilitada.
        // "t.subscription?.status": usa "?." por si subscription es null.
        const isSuspended = t.subscription?.status === 'SUSPENDED';
        return (
          // Div del menú flotante con posición calculada dinámicamente.
          // "e.stopPropagation()": el clic dentro del menú no cierra la tarjeta.
          // "style={{ position: 'fixed', top, right }}": coordenadas absolutas a la ventana.
          // "z-50": capa superior para aparecer sobre todo lo demás.
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
            className="z-50 w-56 bg-white rounded-lg border border-gray-200 shadow-lg py-1"
          >
            {/* Opción 1: Ver detalle (navega a la página de detalle del tenant). */}
            <Link
              href={`/platform/tenants/${t.id}`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Ver detalle
            </Link>
            {/* Opción 2: Regalar meses (abre el modal grantModal). */}
            <button
              onClick={() => openGrantModal(t)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
            >
              <svg className="w-4 h-4 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
              Regalar meses
            </button>
            {/* Línea divisoria entre opciones neutrales y las peligrosas. */}
            <div className="border-t border-gray-100 my-1" />
            {/* Opción 3 (toggle): si la cuenta NO está suspendida → "Deshabilitar";
                si ya está suspendida → "Habilitar". El ternario cambia el botón completo. */}
            {!isSuspended ? (
              // Botón rojo para suspender.
              <button
                onClick={() => handleQuickStatus(t, 'SUSPENDED')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                </svg>
                Deshabilitar cuenta
              </button>
            ) : (
              // Botón verde para reactivar.
              <button
                onClick={() => handleQuickStatus(t, 'ACTIVE')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-700 hover:bg-green-50 text-left"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Habilitar cuenta
              </button>
            )}
          </div>
        );
      })()}

      {/* ── MODAL: REGALAR MESES ─────────────────────────────────────────────
          Aparece cuando grantModal no es null.
          Fondo semitransparente ("bg-black/40") + centrado con flex.
          Tiene dos estados: formulario de selección O confirmación de éxito. */}
      {grantModal && (
        // Overlay oscuro a pantalla completa, centrado con flex.
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Regalar meses</h3>
            {/* Nombre del tenant al que se le regalarán los meses. */}
            <p className="text-sm text-gray-500 mb-4">{grantModal.tenant.name}</p>

            {/* Ternario: si la operación fue exitosa, muestra el mensaje de éxito;
                si no, muestra el formulario de selección de meses. */}
            {grantModal.success ? (
              // Vista de éxito: mensaje verde + botón de cerrar.
              <div className="space-y-4">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 font-medium">{grantModal.success}</p>
                </div>
                <button
                  onClick={() => setGrantModal(null)}
                  className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              // Vista de formulario: botones rápidos + input personalizado.
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Meses a regalar</label>
                  {/* Grid de 4 botones de acceso rápido: 1, 3, 6, 12 meses.
                      .map((m) => ...): genera un botón por cada cantidad.
                      El ternario en className aplica teal si m === grantModal.months (seleccionado),
                      o blanco si no está seleccionado. */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[1, 3, 6, 12].map((m) => (
                      <button
                        key={m}
                        onClick={() => setGrantModal((prev) => prev ? { ...prev, months: m } : null)}
                        className={`py-2 rounded-lg text-sm font-medium border ${
                          grantModal.months === m
                            ? 'bg-[#008080] text-white border-[#008080]'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {/* Ternario: "mes" en singular si m === 1, "meses" si es mayor. */}
                        {m} {m === 1 ? 'mes' : 'meses'}
                      </button>
                    ))}
                  </div>
                  {/* Input numérico para cantidad personalizada (1-60).
                      parseInt(e.target.value, 10): convierte el string del input a entero base 10.
                      Number.isFinite(v): verifica que la conversión fue válida (no NaN, no Infinity).
                      Si no es válido, pone 1 como fallback. */}
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={grantModal.months}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setGrantModal((prev) => prev ? { ...prev, months: Number.isFinite(v) ? v : 1 } : null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Cantidad personalizada (1-60)"
                  />
                </div>

                {/* Cuadro informativo en teal: explica el efecto de regalar meses.
                    "{grantModal.months} mes{...}": muestra la cantidad seleccionada.
                    Ternario "!== 1 ? 'es' : ''": agrega "es" para plural, vacío para singular. */}
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800">
                  Se regalarán <strong>{grantModal.months} mes{grantModal.months !== 1 ? 'es' : ''} gratis</strong>: la cuenta queda <strong>activa</strong> (cubierta por cortesía de Siliba) y la próxima fecha de cobro se mueve {grantModal.months} mes{grantModal.months !== 1 ? 'es' : ''} más adelante. No se generan cobros durante ese período, queda registrado como cortesía y el negocio recibe una notificación.
                </div>

                {/* "grantModal.error &&": solo muestra el error si existe. */}
                {grantModal.error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {grantModal.error}
                  </div>
                )}

                {/* Fila de botones: Confirmar (teal) + Cancelar (blanco).
                    "disabled={grantModal.saving || grantModal.months < 1 || grantModal.months > 60}":
                    bloquea Confirmar si: hay operación en curso, o meses fuera del rango permitido. */}
                <div className="flex gap-2">
                  <button
                    onClick={submitGrantMonths}
                    disabled={grantModal.saving || grantModal.months < 1 || grantModal.months > 60}
                    className="flex-1 px-4 py-2 bg-[#008080] text-white rounded-lg text-sm font-medium hover:bg-[#006666] disabled:opacity-50"
                  >
                    {/* Ternario: texto de carga mientras se procesa, o texto normal. */}
                    {grantModal.saving ? 'Aplicando...' : 'Confirmar'}
                  </button>
                  {/* Cancelar cierra el modal sin hacer nada.
                      Desactivado durante la operación para no cerrar accidentalmente. */}
                  <button
                    onClick={() => setGrantModal(null)}
                    disabled={grantModal.saving}
                    className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
