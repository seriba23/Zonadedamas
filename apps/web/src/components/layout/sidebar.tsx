// ─────────────────────────────────────────────────────────────────────────────
// Sidebar — menú lateral del PANEL DE ADMINISTRACIÓN del negocio.
//
// QUÉ HACE: pinta la lista de secciones (Inicio, Citas, Clientes...), resalta la
//   que coincide con la URL actual, oculta las que el usuario no tiene permiso de
//   ver, muestra insignias de notificaciones sin leer y, abajo, el usuario con
//   botón de cerrar sesión. En móvil aparece como cajón deslizante.
//
// CONCEPTOS DE REACT/NEXT QUE USA:
// - Link (next/link): navegación entre páginas SIN recargar (más rápido que <a>).
// - usePathname(): hook de Next que devuelve la URL actual (ej. "/clients").
// - Hooks propios: useAuth (usuario logueado), usePermissions (permisos),
//   useUnreadCounts (contadores de notificaciones).
// - useState con un Set: para recordar qué submenús están desplegados.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';            // Usuario actual + logout.
import { usePermissions } from '@/lib/hooks/use-permissions'; // ¿Tiene tal permiso?
import { useUnreadCounts } from '@/lib/hooks/use-staff-notifications'; // Contadores no leídos.
import { getInitials } from '@/lib/utils';                 // Iniciales para el avatar.
import { cn } from '@/lib/utils';                          // Une clases CSS condicionalmente.
import { ThemeToggle } from '@/components/ui/theme-toggle'; // Botón claro/oscuro.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Forma de un SUB-elemento de menú (los que cuelgan dentro de un menú padre).
interface NavChild {
  label: string;       // Texto visible.
  href: string;        // Ruta a la que navega.
  permission?: string; // Permiso requerido para verlo (opcional).
}

// Forma de un elemento de menú principal.
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode; // El icono ya renderizado como JSX (no un string).
  permission?: string;   // Permiso para verlo (opcional).
  children?: NavChild[]; // Submenú (opcional).
  section?: string;      // clave para matchear con unreadCounts.counts
}

// `I` es una pequeña función-fábrica de iconos: recibe el "path" SVG (la `d`)
// y devuelve el <svg> ya armado. Así no repetimos el boilerplate del SVG en
// cada item del menú; solo cambia el dibujo interior.
const I = (d: string) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

// Megáfono: identifica el acceso al portal de reclutamiento.
const CREATOR_ICON = I('M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46');

const navItems: NavItem[] = [
  { label: 'Inicio', href: '/home', icon: I('M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25') },
  { label: 'Punto de Venta', href: '/pos', icon: I('M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z'), permission: 'payments.create' },
  { label: 'Reportes', href: '/reports', icon: I('M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z'), permission: 'reports.revenue' },
  { label: 'Citas', href: '/calendar', icon: I('M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5'), permission: 'appointments.read', section: 'appointments' },
  { label: 'Recordatorios', href: '/reminders', icon: I('M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9a6 6 0 00-12 0v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0'), permission: 'appointments.read' },
  { label: 'Clientes', href: '/clients', icon: I('M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z'), permission: 'clients.read' },
  { label: 'Servicios', href: '/services', icon: I('M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z'), permission: 'services.read' },
  { label: 'Personal', href: '/staff', icon: I('M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z'), permission: 'employees.read' },
  { label: 'Inventario', href: '/inventory', icon: I('M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z'), permission: 'inventory.read', section: 'inventory' },
  { label: 'Proveedores', href: '/suppliers', icon: I('M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12'), permission: 'inventory.read' },
  { label: 'Tienda', href: '/shop', icon: I('M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z'), permission: 'inventory.read', section: 'shop' },
  { label: 'Reseñas', href: '/reviews', icon: I('M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z'), permission: 'tenant.read', section: 'reviews' },
  { label: 'Notificaciones', href: '/settings/notifications', icon: I('M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0'), permission: 'notifications.manage' },
  { label: 'Configuración', href: '/settings', icon: I('M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z'), permission: 'tenant.update' },
  // Suscripción como sección propia del menú (sacada de Configuración). Solo dueño.
  { label: 'Suscripción', href: '/settings/subscription', icon: I('M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z'), permission: 'tenant.update' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps = {}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const { data: unread } = useUnreadCounts();

  function badgeFor(section?: string): number {
    if (!section || !unread) return 0;
    return unread.counts[section] ?? 0;
  }

  const visibleItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  // Auto-expand if any child matches current path
  const initialExpanded = navItems
    .filter((item) => item.children?.some((child) => pathname === child.href))
    .map((item) => item.label);

  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(
    new Set(initialExpanded),
  );

  function toggleMenu(label: string) {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  return (
    <>
      {/* Backdrop (mobile only) */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 z-30 md:hidden transition-opacity duration-200',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 w-64 flex flex-col z-40 transition-transform duration-200',
          'md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
        }}
      >
      {/* Logo + theme toggle + close button */}
      <div
        className="h-16 flex items-center justify-between px-4 md:px-6"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[22px] font-extrabold tracking-[-0.02em] text-[#008080]">
            Siliba
          </span>
          {/* Toggle de tema visible junto al logo en desktop */}
          <span className="hidden md:inline-flex">
            <ThemeToggle />
          </span>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 -mr-1.5 rounded-lg transition-colors text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
          aria-label="Cerrar menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            if (item.children) {
              const isExpanded = expandedMenus.has(item.label);
              const isChildActive = item.children.some(
                (child) => pathname === child.href,
              );
              const visibleChildren = item.children.filter(
                (child) => !child.permission || hasPermission(child.permission),
              );

              return (
                <li key={item.label}>
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isChildActive
                        ? 'bg-[var(--bg-muted)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]',
                    )}
                  >
                    <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    <svg
                      className={cn(
                        'w-4 h-4 transition-transform',
                        isExpanded ? 'rotate-180' : '',
                      )}
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
                  {isExpanded && (
                    <ul className="mt-1 ml-8 space-y-0.5">
                      {visibleChildren.map((child) => {
                        const isActive = pathname === child.href;
                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={onClose}
                              className={cn(
                                'block px-3 py-2 rounded-lg text-sm transition-colors',
                                isActive
                                  ? 'bg-[var(--bg-muted)] text-[var(--text-primary)] font-medium'
                                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]',
                              )}
                            >
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            }

            const isActive =
              pathname === item.href ||
              (item.href !== '/calendar' && pathname.startsWith(item.href));

            const count = badgeFor(item.section);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-[11px] px-3 py-2 rounded-[10px] text-[13.5px] transition-colors',
                    isActive
                      ? 'bg-[#008080] text-white font-bold'
                      : 'text-[#5b6e6a] font-semibold hover:bg-[#eff6f4] hover:text-[#008080]',
                  )}
                >
                  <span className="w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {count > 0 && (
                    <span
                      className="min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                      style={{ backgroundColor: '#c14242' }}
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}

          {/* Grupo "Reclutamiento": acceso al portal de reclutadores en NEGRO
              para que sea distintivo (no se confunde con las secciones normales
              del negocio). Lleva al inicio de sesión de reclutadores; ya dentro
              (si están aprobados) verán su portal. */}
          <li className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Reclutamiento
            </p>
            <Link
              href="/creator/intro"
              onClick={onClose}
              className="flex items-center gap-[11px] px-3 py-2.5 rounded-[10px] text-[13.5px] font-semibold bg-gray-900 text-white hover:bg-black transition-colors"
            >
              <span className="w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center">{CREATOR_ICON}</span>
              <span className="flex-1">Reclutadores</span>
              <svg className="w-4 h-4 text-white/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </li>
        </ul>
      </nav>

      {/* User section */}
      {user && (
        <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div
            className={`flex items-center gap-3 mb-3 ${user.employeeId ? 'cursor-pointer rounded-lg p-1.5 -m-1.5 transition-colors hover:bg-[var(--bg-muted)]' : ''}`}
            onClick={() => { if (user.employeeId) window.location.href = '/employee'; }}
            title={user.employeeId ? `Cambiar a ${user.jobTitle || 'Empleado'}` : undefined}
          >
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold flex-shrink-0 overflow-hidden">
              {user.avatarUrl ? (
                <img src={`${API_URL}${user.avatarUrl}`} alt="" className="w-full h-full object-cover" />
              ) : (
                getInitials(user.firstName, user.lastName)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{user.email}</p>
            </div>
            {user.employeeId && (
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            )}
          </div>
          <button
            onClick={async () => {
              await logout();
              // Full reload garantiza limpiar estado de React, websockets,
              // queries cacheadas y cualquier service worker.
              window.location.replace('/login');
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Cerrar sesión
          </button>
        </div>
      )}
      </aside>
    </>
  );
}
