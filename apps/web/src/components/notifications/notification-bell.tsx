// 'use client': el dropdown usa estado (open/close) y eventos del DOM — requiere navegador.
'use client';

// useEffect: para registrar/desregistrar el listener de click-fuera del dropdown.
// useRef: referencia al contenedor DOM para detectar clicks fuera.
// useState: para controlar si el dropdown está abierto o cerrado.
import { useEffect, useRef, useState } from 'react';
// Link: navegación interna de Next.js (sin recarga completa de la página).
import Link from 'next/link';
// useRouter: para navegar programáticamente al hacer click en una notificación.
import { useRouter } from 'next/navigation';
// Hooks específicos del sistema de notificaciones del staff:
// - useNotificationsList: obtiene la lista paginada de notificaciones.
// - useUnreadCounts: obtiene los contadores de no leídas por sección y el total.
// - useMarkRead: mutación para marcar una notificación como leída.
// - useMarkAllRead: mutación para marcar todas como leídas de una sola vez.
// - StaffNotification: interfaz TypeScript con la forma de cada notificación.
import {
  useNotificationsList,
  useUnreadCounts,
  useMarkRead,
  useMarkAllRead,
  type StaffNotification,
} from '@/lib/hooks/use-staff-notifications';

// TEAL: constante con el color corporativo teal, reutilizada en múltiples lugares.
const TEAL = '#008080';

// timeAgo: función pura que convierte una fecha ISO ("2026-06-24T10:00:00Z") en
// texto relativo legible ("ahora", "hace 5 min", "hace 2 h", "hace 3 d", o "24 jun").
// Pasos del cálculo:
// 1. new Date(iso): convierte el string ISO en objeto Date.
// 2. Date.now() - date.getTime(): diferencia en milisegundos.
// 3. / 1000: convierte a segundos.
// 4. Math.floor: redondea hacia abajo (descarta fracciones).
// Si es < 60s → "ahora"; < 60min → "hace N min"; < 24h → "hace N h";
// < 7 días → "hace N d"; más → fecha formateada en español de México.
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
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

// NotificationBellProps: interfaz de las props del componente.
// basePath: prefijo de la ruta para el enlace "Ver todas".
// Por defecto '/employee' (portal empleado); puede ser '/dashboard' (admin).
interface NotificationBellProps {
  basePath?: string; // '/employee' o '/dashboard' para el "ver todas"
}

// NotificationBell: campana de notificaciones en el header.
// Muestra un badge rojo con el número de no leídas.
// Al hacer click, abre un dropdown con las últimas 8 notificaciones.
export function NotificationBell({ basePath = '/employee' }: NotificationBellProps) {
  // open: estado booleano que controla si el dropdown está visible.
  // setOpen: función para cambiar open.
  const [open, setOpen] = useState(false);

  // containerRef: referencia al div raíz del componente (campana + dropdown).
  // Se usa para detectar si un click ocurrió FUERA de este elemento.
  // useRef<HTMLDivElement>(null): inicialmente null, luego apunta al DOM real.
  const containerRef = useRef<HTMLDivElement>(null);

  // useRouter: permite navegar al hacer click en una notificación con link.
  const router = useRouter();

  // useUnreadCounts: obtiene { total: number, counts: Record<string, number> }.
  // data se renombra a 'counts' para mayor claridad.
  const { data: counts } = useUnreadCounts();

  // useNotificationsList: obtiene las últimas notificaciones paginadas.
  // perPage: 8 → solo las 8 más recientes (el dropdown no es un inbox completo).
  // data se renombra a 'list'.
  const { data: list, isLoading } = useNotificationsList({ perPage: 8 });

  // markRead: mutación para marcar una notificación específica como leída (por id).
  const markRead = useMarkRead();

  // markAllRead: mutación para marcar TODAS las notificaciones como leídas.
  const markAllRead = useMarkAllRead();

  // total: número total de notificaciones sin leer.
  // ?? 0: si counts es undefined (aún cargando), usa 0.
  const total = counts?.total ?? 0;

  // items: array de notificaciones a mostrar en el dropdown.
  // ?? []: si list.data es undefined, usa array vacío.
  const items = list?.data ?? [];

  // useEffect: registra un listener global de 'mousedown' cuando el dropdown está abierto.
  // Propósito: cerrar el dropdown cuando el usuario hace click fuera de él.
  // Dependencia [open]: se re-ejecuta solo cuando 'open' cambia.
  useEffect(() => {
    // Si el dropdown no está abierto, no hace falta el listener → salir temprano.
    if (!open) return;

    // handler: función que verifica si el click fue fuera del contenedor.
    // e.target: el elemento que recibió el click.
    // containerRef.current.contains(e.target): true si el click fue DENTRO del div.
    // Si el click fue FUERA (contains = false): cerramos el dropdown.
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    // Función de limpieza: se ejecuta cuando open cambia a false o el componente se desmonta.
    // Evita fugas de memoria (memory leaks) por listeners acumulados.
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // handleClick: función que se ejecuta al hacer click en una notificación.
  // 1. Cierra el dropdown.
  // 2. Si la notificación no está leída (readAt es null), la marca como leída.
  // 3. Si la notificación tiene un link (deep-link a cita, pago, etc.), navega allí.
  function handleClick(n: StaffNotification) {
    setOpen(false);
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) router.push(n.link);
  }

  // ── JSX: campana + dropdown ────────────────────────────────────────────────
  // El div raíz tiene position: relative para que el dropdown se posicione relativo a él.
  return (
    <div className="relative" ref={containerRef}>
      {/* Botón campana: al hacer click, alterna open entre true/false.
          (v) => !v: función que recibe el valor actual y devuelve su negación. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-[var(--text-secondary)] hover:text-[#008080] hover:bg-[var(--bg-muted)] transition-colors"
        aria-label="Notificaciones"
      >
        {/* Ícono de campana en SVG */}
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {/* Badge rojo con el conteo: solo si total > 0.
            total > 99 ? '99+' : total: muestra "99+" para evitar números muy largos.
            position: absolute con -top / -right para posicionar sobre la campana. */}
        {total > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ backgroundColor: '#dc2626' }}
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {/* Dropdown: solo se renderiza cuando open = true (renderizado condicional con &&). */}
      {open && (
        <>
          {/* Backdrop transparente en móvil: cubre toda la pantalla para capturar
              clicks fuera del dropdown (en desktop lo maneja el listener mousedown). */}
          {/* Backdrop solo en mobile para cerrar tocando fuera */}
          <div
            className="fixed inset-0 z-40 sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Panel del dropdown: ocupa toda la pantalla en móvil (fixed, top-0),
              y se posiciona como un popup en desktop (absolute, right-0, mt-2). */}
          <div
            className="fixed left-0 right-0 top-0 w-full max-w-full rounded-none border-0 border-t border-[var(--border)] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[340px] sm:max-w-[95vw] sm:rounded-xl sm:border bg-[var(--bg-surface)] shadow-lg border-[var(--border)] z-50 overflow-hidden"
            role="menu"
            style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
          >
          {/* Encabezado del dropdown: título + "Marcar todas" + botón cierre (móvil). */}
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-sm font-bold text-[var(--text-primary)]">Notificaciones</span>
            <div className="flex items-center gap-2">
              {/* "Marcar todas": solo aparece si hay notificaciones sin leer. */}
              {total > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate(undefined)}
                  className="text-xs font-semibold transition-colors hover:underline"
                  style={{ color: TEAL }}
                >
                  Marcar todas
                </button>
              )}
              {/* Botón X para cerrar: solo visible en móvil (sm:hidden lo oculta en desktop). */}
              {/* Cerrar visible solo en mobile (en desktop click fuera basta) */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="sm:hidden p-1 -mr-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Lista de notificaciones con scroll si hay muchas. */}
          {/* List */}
          <div className="max-h-[70vh] sm:max-h-[60vh] overflow-y-auto">
            {/* Estado de carga: muestra "Cargando..." mientras llegan los datos. */}
            {isLoading && (
              <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">Cargando...</div>
            )}
            {/* Estado vacío: sin notificaciones. */}
            {!isLoading && items.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                No tienes notificaciones aun.
              </div>
            )}
            {/* Lista de notificaciones: items.map() genera un botón por cada una.
                key={n.id}: identificador único de la notificación en la BD.
                n.readAt: null si no leída; fecha si ya fue leída.
                Notificaciones no leídas → fondo teal claro + borde izquierdo teal.
                Leídas → sin fondo especial. */}
            {!isLoading &&
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-[var(--border)] hover:bg-[var(--bg-muted)] transition-colors flex gap-3 ${n.readAt ? '' : 'bg-teal-50 border-l-[3px] border-l-[#008080]'}`}
                >
                  {/* Punto indicador: teal si no leída, transparente si ya leída. */}
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: n.readAt ? 'transparent' : TEAL }}
                  />
                  <div className="min-w-0 flex-1">
                    {/* Título de la notificación (truncate: no se desborda). */}
                    <p className={`text-sm font-semibold truncate ${n.readAt ? 'text-[var(--text-primary)]' : 'text-gray-900'}`}>{n.title}</p>
                    {/* Cuerpo de la notificación (line-clamp-2: máximo 2 líneas visibles). */}
                    <p className={`text-xs line-clamp-2 ${n.readAt ? 'text-[var(--text-secondary)]' : 'text-gray-700'}`}>{n.body}</p>
                    {/* Tiempo relativo usando la función timeAgo definida arriba. */}
                    <p className={`text-[11px] mt-0.5 ${n.readAt ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))}
          </div>

          {/* Pie del dropdown: enlace "Ver todas" → inbox completo.
              Template literal: `${basePath}/inbox` → "/employee/inbox" o "/dashboard/inbox". */}
          {/* Footer */}
          <Link
            href={`${basePath}/inbox`}
            onClick={() => setOpen(false)}
            className="block text-center text-sm font-semibold py-3 border-t border-[var(--border)] hover:bg-[var(--bg-muted)] transition-colors"
            style={{ color: TEAL }}
          >
            Ver todas
          </Link>
          </div>
        </>
      )}
    </div>
  );
}
