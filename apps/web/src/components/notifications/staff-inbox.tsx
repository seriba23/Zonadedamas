// 'use client': usa useState y useEffect — requiere contexto del navegador.
'use client';

// useEffect: para leer el permiso de notificaciones push al montar el banner.
// useState: múltiples estados del inbox (página, filtros, si mostrar modal, etc.).
import { useEffect, useState } from 'react';
// Link: navegación interna sin recarga (para notificaciones con deep-link).
import Link from 'next/link';
// Hooks del sistema de notificaciones del staff.
import {
  useNotificationsList,  // Lista paginada de notificaciones
  useUnreadCounts,        // Contadores de no leídas por sección
  useMarkRead,            // Mutación: marcar una como leída
  useMarkAllRead,         // Mutación: marcar todas como leídas
} from '@/lib/hooks/use-staff-notifications';
// Funciones para gestionar notificaciones push del navegador (Web Push API).
import {
  pushSupported,          // ¿El navegador soporta push?
  pushPermission,         // Estado actual del permiso ('default'|'granted'|'denied'|'unsupported')
  registerServiceWorker,  // Registra el service worker necesario para push
  requestPushPermission,  // Solicita permiso al usuario (muestra el popup del navegador)
  subscribePushOnServer,  // Envía la suscripción al backend para guardarla en BD
} from '@/lib/push';
// Modal: componente de diálogo/overlay reutilizable del proyecto.
import { Modal } from '@/components/ui/modal';

// TEAL: color corporativo principal del proyecto.
const TEAL = '#008080';

// SECTION_LABELS: mapa de claves técnicas a etiquetas en español para el usuario.
// Record<string, string>: cada clave es un string y su valor es otro string.
// ?? s: si la clave no existe en el mapa, devuelve la clave sin transformar.
const SECTION_LABELS: Record<string, string> = {
  appointments: 'Citas',
  shop: 'Tienda',
  payments: 'Pagos',
  reviews: 'Reseñas',
  inventory: 'Inventario',
  reservations: 'Apartados',
};

// sectionLabel: convierte la clave técnica de una sección al texto en español.
// SECTION_LABELS[s]: busca la clave 's' en el objeto. ?? s: fallback si no existe.
function sectionLabel(s: string): string {
  return SECTION_LABELS[s] ?? s;
}

// timeAgo: igual que en notification-bell.tsx — convierte una fecha ISO en texto
// relativo ("ahora", "hace N min/h/d" o fecha formateada con año).
function timeAgo(iso: string): string {
  const date = new Date(iso);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// PermissionBanner: banner que solicita permiso para notificaciones push del navegador.
// Se muestra automáticamente en el inbox si el permiso no está otorgado.
// Es un componente interno (no exportado): solo lo usa StaffInbox.
function PermissionBanner() {
  // permission: estado del permiso de notificaciones.
  // NotificationPermission: tipo nativo ('default'|'granted'|'denied').
  // 'unsupported': valor propio del proyecto si el navegador no soporta push.
  // null: valor inicial antes de verificar (evita el "flash" antes de saber el estado).
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported' | null>(null);

  // busy: true mientras se está procesando la solicitud de permiso (deshabilita el botón).
  const [busy, setBusy] = useState(false);

  // useEffect sin dependencias específicas ([] = solo al montar el componente).
  // Lee el estado actual del permiso push y lo guarda en el estado.
  useEffect(() => {
    setPermission(pushPermission());
  }, []);

  // Mientras permission no se ha leído aún (null) → no mostrar nada.
  if (permission === null) return null;

  // Si el navegador no soporta push: mostrar mensaje informativo en gris.
  if (permission === 'unsupported') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 mb-4">
        Tu navegador no soporta notificaciones push. Las notificaciones in-app
        siguen funcionando aqui.
      </div>
    );
  }

  // Si ya tiene permiso concedido → no mostrar el banner (ya no es necesario).
  if (permission === 'granted') return null;

  // handleEnable: función async que solicita permiso y, si se concede, registra la suscripción.
  // try/finally: garantiza que busy siempre vuelva a false, incluso si hay un error.
  async function handleEnable() {
    setBusy(true);
    try {
      // 1. Registrar service worker (requisito técnico para usar push en el navegador).
      await registerServiceWorker();
      // 2. Mostrar el popup nativo del navegador para pedir permiso.
      const result = await requestPushPermission();
      setPermission(result);
      // 3. Si el usuario aceptó: enviar la suscripción al backend para guardarla.
      if (result === 'granted') {
        await subscribePushOnServer();
      }
    } finally {
      setBusy(false);
    }
  }

  // Banner teal con ícono + texto + botón de activación.
  return (
    <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
      {/* Ícono de campana en teal */}
      <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#008080]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-teal-800">
          Activa las notificaciones del navegador
        </p>
        <p className="text-xs text-teal-700 mt-0.5">
          Recibe avisos de citas nuevas, cancelaciones y mas, aun cuando la app
          este cerrada en tu telefono o computadora.
        </p>
        {/* Botón de activación: deshabilitado si está procesando (busy) o si ya fue denegado.
            disabled:opacity-50: Tailwind reduce la opacidad cuando el botón está deshabilitado.
            Ternario anidado: busy ? '...' : (denied ? '...' : '...') */}
        <button
          onClick={handleEnable}
          disabled={busy || permission === 'denied'}
          className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-full text-white disabled:opacity-50"
          style={{ backgroundColor: TEAL }}
        >
          {busy
            ? 'Activando...'
            : permission === 'denied'
              ? 'Bloqueadas en el navegador'
              : 'Activar notificaciones'}
        </button>
        {/* Instrucción extra solo si el permiso fue denegado por el usuario. */}
        {permission === 'denied' && (
          <p className="text-[11px] text-gray-500 mt-1">
            Habilita las notificaciones desde la configuracion del sitio en tu
            navegador para poder activarlas.
          </p>
        )}
      </div>
    </div>
  );
}

// StaffInbox: página completa del inbox de notificaciones del staff.
// Características:
// - Filtro "Solo no leídas" (toggle).
// - Filtro por sección (Citas, Pagos, Reseñas…) via modal.
// - Paginación (página actual / total de páginas).
// - Botón "Marcar todas" que marca todas las notificaciones de la sección activa.
// - Cada notificación navega a su deep-link si tiene uno.
export function StaffInbox() {
  // unreadOnly: si true, la lista solo muestra notificaciones sin leer.
  const [unreadOnly, setUnreadOnly] = useState(false);

  // section: filtro de sección activo (undefined = todas las secciones).
  const [section, setSection] = useState<string | undefined>(undefined);

  // draftSection: selección temporal en el modal de filtros, antes de aplicar.
  // Permite que el usuario cambie sin afectar la lista hasta hacer click en "Aplicar".
  const [draftSection, setDraftSection] = useState<string | undefined>(undefined);

  // showFilters: controla si el modal de filtros está visible.
  const [showFilters, setShowFilters] = useState(false);

  // page: página actual de la paginación (empieza en 1).
  const [page, setPage] = useState(1);

  // openFilters: al abrir el modal, copia el filtro actual al borrador.
  // Así el usuario ve su selección anterior y puede modificarla o cancelar.
  function openFilters() {
    setDraftSection(section);
    setShowFilters(true);
  }

  // applyFilters: confirma el borrador como filtro activo.
  // Resetea la página a 1 porque la nueva sección puede tener menos páginas.
  function applyFilters() {
    setSection(draftSection);
    setPage(1);
    setShowFilters(false);
  }

  // clearDraftFilters: limpia la selección en el modal (vuelve a "Todas").
  function clearDraftFilters() {
    setDraftSection(undefined);
  }

  // Contadores de notificaciones sin leer por sección y total global.
  const { data: counts } = useUnreadCounts();

  // Lista paginada de notificaciones con todos los filtros aplicados.
  const { data: list, isLoading } = useNotificationsList({
    page,
    perPage: 20,   // 20 notificaciones por página
    section,       // undefined = todas, o 'appointments', 'payments', etc.
    unreadOnly,    // false = todas, true = solo no leídas
  });

  // Mutaciones para marcar como leídas.
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  // sectionsWithUnread: secciones que actualmente tienen notificaciones sin leer.
  // Object.keys(counts?.counts ?? {}): obtiene las claves del objeto de contadores.
  const sectionsWithUnread = Object.keys(counts?.counts ?? {});

  // allSections: unión de las secciones predefinidas (SECTION_LABELS) y las que
  // tienen notificaciones actuales. Set elimina duplicados; Array.from() convierte a array.
  // [...A, ...B]: spread operator — une los dos arrays en uno.
  const allSections = Array.from(
    new Set([...Object.keys(SECTION_LABELS), ...sectionsWithUnread]),
  );

  // ── JSX: layout del inbox completo ───────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Encabezado: título + conteo de no leídas a la izquierda;
          botones de acción a la derecha (Marcar todas, No leídas, Filtros). */}
      {/* Header */}
      {/* Header: titulo a la izq + 3 botones alineados a la derecha
          (Marcar todas, No leidas, icono Filtros). Mismo "box" para los
          tres (altura, padding, radius coherente). */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">Notificaciones</h1>
          {/* counts?.total ?? 0: número de sin leer (0 si aún cargando). */}
          <p className="text-sm text-gray-500 mt-0.5">
            {counts?.total ?? 0} sin leer
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* "Marcar todas": solo visible si hay al menos 1 sin leer.
              markAllRead.mutate(section): marca todas las de la sección actual como leídas.
              Si section=undefined, marca absolutamente todas. */}
          {(counts?.total ?? 0) > 0 && (
            <button
              onClick={() => markAllRead.mutate(section)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border bg-white border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Marcar todas
            </button>
          )}
          {/* Toggle "No leídas": activa/desactiva el filtro de no leídas.
              Al cambiar, también resetea la página a 1. */}
          <button
            onClick={() => {
              setUnreadOnly((v) => !v);
              setPage(1);
            }}
            className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
              unreadOnly
                ? 'bg-[#008080] border-[#008080] text-white'  // Activo: fondo teal
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50' // Inactivo: blanco
            }`}
          >
            No leídas
          </button>
          {/* Botón ícono de filtros: teal si hay filtro de sección activo. */}
          <button
            type="button"
            onClick={openFilters}
            aria-label="Filtros"
            title="Filtros"
            className={`p-2 rounded-lg border transition-colors ${
              section
                ? 'bg-[#008080] border-[#008080] text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {/* Ícono de embudo/funnel (filtro) */}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Banner para solicitar permiso de notificaciones push (si aplica). */}
      <PermissionBanner />

      {/* Chip que indica el filtro de sección activo.
          Solo aparece si hay una sección seleccionada (section && ...). */}
      {/* Chip de seccion activa (si hay filtro aplicado). */}
      {section && (
        <div className="mb-4">
          <span className="inline-flex text-xs font-medium text-[#008080] bg-teal-50 border border-teal-200 rounded-full px-2.5 py-1">
            {sectionLabel(section)}
          </span>
        </div>
      )}

      {/* Lista de notificaciones dentro de una tarjeta blanca con bordes. */}
      {/* Lista */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Estado de carga: spinner de texto. */}
        {isLoading && (
          <div className="px-4 py-10 text-center text-sm text-gray-400">Cargando...</div>
        )}
        {/* Estado vacío: cuando terminó de cargar pero no hay notificaciones. */}
        {!isLoading && (list?.data?.length ?? 0) === 0 && (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            No hay notificaciones para mostrar.
          </div>
        )}
        {/* Notificaciones: list?.data?.map() itera el array de notificaciones.
            Cada notificación puede ser:
            - Link (si tiene n.link): navega a otra página al hacer click.
            - button (si NO tiene link): solo marca como leída sin navegar.
            El JSX del contenido se guarda en 'content' para no duplicar código. */}
        {!isLoading &&
          list?.data?.map((n) => {
            // wrapperClass: clases comunes + clases condicionales según si está leída.
            // No leída: fondo teal claro + borde izquierdo teal grueso.
            // pl-[13px]: compensa el espacio que ocupa el borde-l de 3px.
            const wrapperClass = `block w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
              n.readAt ? '' : 'bg-teal-50 border-l-[3px] border-l-[#008080] pl-[13px]'
            }`;

            // content: JSX compartido entre Link y button — el cuerpo visual de la notificación.
            const content = (
              <div className="flex gap-3">
                {/* Punto indicador teal (solo si no leída). */}
                <span
                  className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                  style={{ backgroundColor: n.readAt ? 'transparent' : TEAL }}
                />
                <div className="min-w-0 flex-1">
                  {/* Primera fila: título + tiempo relativo. */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  {/* Cuerpo de la notificación. */}
                  <p className="text-xs text-gray-600 mt-0.5">{n.body}</p>
                  {/* Etiqueta de sección en mayúsculas pequeñas (p.ej. "CITAS"). */}
                  <span className="text-[10px] font-semibold text-teal-700 uppercase mt-1 inline-block">
                    {sectionLabel(n.section)}
                  </span>
                </div>
              </div>
            );

            // Si la notificación tiene un link: renderiza como <Link> (navega al hacerla click).
            // Si no tiene link: renderiza como <button> (solo marca como leída).
            return n.link ? (
              <Link
                key={n.id}
                href={n.link}
                onClick={() => {
                  // Al navegar, si no estaba leída → marcarla como leída.
                  if (!n.readAt) markRead.mutate(n.id);
                }}
                className={wrapperClass}
              >
                {content}
              </Link>
            ) : (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.readAt) markRead.mutate(n.id);
                }}
                className={wrapperClass}
              >
                {content}
              </button>
            );
          })}
      </div>

      {/* Paginación: solo aparece si hay más de 1 página.
          list?.meta: metadatos de paginación del backend (page, totalPages, etc.).
          disabled={page <= 1}: deshabilita "Anterior" en la primera página.
          disabled={page >= totalPages}: deshabilita "Siguiente" en la última.
          (p) => p - 1 / p + 1: función que actualiza la página relativa a la actual. */}
      {/* Paginacion */}
      {list?.meta && list.meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-gray-500">
            Pagina {list.meta.page} de {list.meta.totalPages}
          </span>
          <button
            disabled={page >= list.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal de filtros: solo se renderiza cuando showFilters = true.
          Muestra botones para seleccionar "Todas" o una sección específica.
          draftSection: borrador que se aplica solo al confirmar con "Aplicar". */}
      {/* Modal de filtros — secciones (Todas/Citas/Tienda/Pagos/...) */}
      {showFilters && (
        <Modal title="Filtros" onClose={() => setShowFilters(false)} size="md">
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Sección
              </label>
              <div className="space-y-1.5">
                {/* Opción "Todas": activa si draftSection === undefined. */}
                <button
                  type="button"
                  onClick={() => setDraftSection(undefined)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-between ${
                    draftSection === undefined
                      ? 'bg-teal-50 border-teal-200 text-[#008080]'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>Todas</span>
                  {/* Checkmark solo cuando esta opción está seleccionada. */}
                  {draftSection === undefined && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* allSections.map(): genera un botón por cada sección disponible.
                    c: conteo de no leídas en esa sección (0 si no hay ninguna).
                    active: true si draftSection coincide con esta sección. */}
                {allSections.map((s) => {
                  const c = counts?.counts[s] ?? 0;
                  const active = draftSection === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDraftSection(s)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-between ${
                        active
                          ? 'bg-teal-50 border-teal-200 text-[#008080]'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>
                        {sectionLabel(s)}
                        {/* Muestra el conteo de no leídas entre paréntesis si hay alguna. */}
                        {c > 0 && <span className="ml-1.5 font-bold">({c})</span>}
                      </span>
                      {/* Checkmark visible solo en la sección seleccionada. */}
                      {active && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pie del modal: botones "Limpiar" y "Aplicar".
                "Limpiar" solo está activo (rojo) si hay un filtro en borrador.
                disabled={draftSection === undefined}: si ya está limpio, lo desactiva. */}
            <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={clearDraftFilters}
                disabled={draftSection === undefined}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  draftSection !== undefined
                    ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Limpiar
              </button>
              {/* "Aplicar": confirma el borrador y cierra el modal. */}
              <button
                onClick={applyFilters}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#008080] text-white hover:bg-[#006666] transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
