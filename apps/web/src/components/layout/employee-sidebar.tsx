// 'use client': este componente usa hooks del navegador (usePathname, etc.).
'use client';

// Link: componente de Next.js para navegación interna sin recargar la página.
import Link from 'next/link';
// usePathname: hook que devuelve la ruta actual (p.ej. "/employee/appointments").
import { usePathname } from 'next/navigation';
// useAuth: hook que devuelve el usuario autenticado y la función logout.
import { useAuth } from '@/lib/hooks/use-auth';
// useTenantTier: hook que indica el plan del tenant (isFreelancer, isPro, etc.).
import { useTenantTier } from '@/lib/hooks/use-tenant-tier';
// usePermissions: para decidir qué secciones admin concedidas mostrar.
import { usePermissions } from '@/lib/hooks/use-permissions';
// ADMIN_SECTIONS: fuente única de las secciones admin (ruta + permiso + icono).
import { ADMIN_SECTIONS } from '@/lib/admin-access';
// useUnreadCounts: hook que obtiene los contadores de notificaciones no leídas
// por sección (appointments, reviews, payments) y el total global.
import { useUnreadCounts } from '@/lib/hooks/use-staff-notifications';
// getInitials: función que extrae las iniciales del nombre (p.ej. "Juan López" → "JL").
// cn: función que combina clases CSS condicionalmente (como clsx).
import { getInitials, cn } from '@/lib/utils';

// API_URL: URL base del backend. Se lee de la variable de entorno NEXT_PUBLIC_API_URL,
// con fallback a localhost:3001 para desarrollo local.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// NavItem: interfaz que describe cada elemento del menú de navegación lateral.
// section?: campo opcional — si existe, se usa para mostrar badge de notificaciones.
interface NavItem {
  label: string;
  href: string;
  icon: string; // SVG path
  section?: string; // clave para matchear con unreadCounts.counts
}

// I: función identidad — recibe un string SVG path y lo devuelve sin cambios.
// Sirve solo para dar formato visual al array navItems (legibilidad en el código).
const I = (d: string) => d;

// navItems: array estático con todos los elementos del menú lateral del empleado.
// Cada objeto tiene label (texto), href (ruta), icon (SVG path d="...") y
// opcionalmente section (para vincular al contador de notificaciones).
const navItems: NavItem[] = [
  { label: 'Inicio', href: '/employee', icon: I('M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25') },
  { label: 'Mis Citas', href: '/employee/appointments', icon: I('M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5'), section: 'appointments' },
  { label: 'Servicios', href: '/employee/services', icon: I('M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z') },
  { label: 'Asistencia', href: '/employee/attendance', icon: I('M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z') },
  { label: 'Comisiones', href: '/employee/commissions', icon: I('M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z'), section: 'payments' },
  { label: 'Mi Perfil', href: '/employee/profile', icon: I('M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z') },
  { label: 'Reseñas', href: '/employee/reviews', icon: I('M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z'), section: 'reviews' },
  { label: 'Mi Horario', href: '/employee/schedule', icon: I('M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z') },
  { label: 'Permisos', href: '/employee/time-off', icon: I('M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008z') },
  { label: 'Cupones', href: '/employee/rewards', icon: I('M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z') },
  { label: 'Notificaciones', href: '/employee/inbox', icon: I('M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0'), section: '__total__' },
  { label: 'Suscripción', href: '/employee/subscription', icon: I('M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z') },
  { label: 'Configuración', href: '/employee/settings', icon: I('M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z') },
];

// Íconos de los items condicionales (mismos paths que el sidebar del dashboard).
const POS_ICON = I('M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z');
const INVENTORY_ICON = I('M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z');
const SHOP_ICON = I('M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z');
const DEPOSIT_ICON = I('M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z');

// EmployeeSidebarProps: props del componente EmployeeSidebar.
// isOpen: controla si el sidebar está visible en móvil (true = visible).
// onClose: función que el padre llama para cerrar el sidebar (en móvil).
// Ambas son opcionales porque en desktop el sidebar siempre está fijo.
interface EmployeeSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

// EmployeeSidebar: barra lateral de navegación para el portal de empleados.
// En desktop: fija a la izquierda siempre visible (lg:translate-x-0).
// En móvil: se desliza desde la izquierda (translate-x-0 / -translate-x-full).
// Muestra: logo, menú de navegación con badges, y perfil del usuario al pie.
// Parámetros con valores por defecto: isOpen=false, onClose=undefined.
export function EmployeeSidebar({ isOpen = false, onClose }: EmployeeSidebarProps = {}) {
  // usePathname: devuelve la ruta actual para resaltar el ítem activo del menú.
  const pathname = usePathname();
  // user: datos del usuario logueado; logout: función para cerrar sesión.
  const { user, logout } = useAuth();
  // isFreelancer: true si el tenant está en el plan freelancer (muestra el botón "Mejora a PLUS").
  const { isFreelancer } = useTenantTier();

  // isOwner: solo el DUEÑO (rol owner) conserva el portal admin completo y el
  // botón de cambio de perfil. Los admins parciales (helper) acceden a sus
  // secciones desde este mismo sidebar (grupo "Administración" más abajo).
  const isOwner = user?.isOwner === true;

  // hasPermission: para filtrar qué secciones admin concedidas mostrar.
  const { hasPermission } = usePermissions();
  // adminSections: secciones admin que este usuario tiene permiso de usar. El
  // dueño NO las ve aquí (usa el portal admin completo); solo los no-dueños con
  // acceso parcial concedido.
  const adminSections = isOwner
    ? []
    : ADMIN_SECTIONS.filter((s) => hasPermission(s.permission));

  // unread: contadores de notificaciones no leídas por sección.
  // data se desestructura como "unread" para mayor claridad.
  const { data: unread } = useUnreadCounts();

  // badgeFor: devuelve el número de notificaciones sin leer para una sección.
  // - Si section es '__total__': devuelve el total global de todas las secciones.
  // - Si section es otro valor (p.ej. 'appointments'): busca en unread.counts.
  // - ?? 0: si el valor es undefined/null (sección sin notificaciones), usa 0.
  function badgeFor(section?: string): number {
    if (!section || !unread) return 0;
    if (section === '__total__') return unread.total;
    return unread.counts[section] ?? 0;
  }

  // menuItems: lista final del menú. Partimos de la estática (navItems) e
  // insertamos items condicionales:
  //   - "Punto de Venta": si el empleado tiene posEnabled o es freelancer.
  //   - "Inventario"/"Tienda": solo para freelancer (vende productos online).
  const showPos = !!user?.posEnabled || isFreelancer;
  const menuItems: NavItem[] = [];
  for (const item of navItems) {
    menuItems.push(item);
    if (item.href === '/employee/appointments' && showPos) {
      menuItems.push({ label: 'Punto de Venta', href: '/employee/pos', icon: POS_ICON });
    }
    if (item.href === '/employee/services' && isFreelancer) {
      menuItems.push({ label: 'Inventario', href: '/employee/inventory', icon: INVENTORY_ICON });
      menuItems.push({ label: 'Tienda', href: '/employee/shop', icon: SHOP_ICON });
      menuItems.push({ label: 'Anticipo', href: '/employee/anticipo', icon: DEPOSIT_ICON });
    }
  }

  // DEDUP: si al empleado se le concedió la sección admin equivalente (Servicios,
  // Cupones), ocultamos su versión NATIVA de empleado para no duplicar la entrada
  // en el menú (ambas abren lo mismo). La versión admin (más completa) la sustituye.
  const SUPERSEDED_BY_ADMIN: Record<string, string> = {
    '/employee/services': 'services',
    '/employee/rewards': 'rewards',
  };
  const grantedAdminKeys = new Set(adminSections.map((s) => s.key));
  // "Suscripción" solo la ven freelancers (es su único portal) y el dueño; un
  // empleado normal no gestiona la suscripción del negocio.
  const canSeeSubscription = isFreelancer || isOwner;
  const visibleMenu = menuItems.filter((item) => {
    const adminKey = SUPERSEDED_BY_ADMIN[item.href];
    if (adminKey && grantedAdminKeys.has(adminKey)) return false;
    if (item.href === '/employee/subscription' && !canSeeSubscription) return false;
    return true;
  });

  // NavIcon: sub-componente interno que renderiza un ícono SVG.
  // Recibe d (el path SVG) y className (clases Tailwind opcionales).
  // Permite reutilizar la misma estructura SVG cambiando solo el path.
  function NavIcon({ d, className }: { d: string; className?: string }) {
    return (
      <svg className={className || 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      </svg>
    );
  }

  // ── JSX: fragment con backdrop (oscuro) + aside (panel lateral) ───────────
  return (
    <>
      {/* Backdrop oscuro: solo en móvil. Al hacer click, cierra el sidebar.
          cn() combina clases según si isOpen es true o false:
          - opacity-100 + pointer-events-auto: visible y clickeable.
          - opacity-0 + pointer-events-none: invisible e ignorado por el ratón. */}
      {/* Backdrop (mobile only) */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 z-30 lg:hidden transition-opacity duration-200',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* aside: el panel lateral propiamente dicho.
          fixed inset-y-0 left-0: pegado al borde izquierdo, altura completa.
          translate-x-0: en desktop siempre visible (lg:translate-x-0).
          -translate-x-full: fuera de pantalla por defecto en móvil;
          translate-x-0 cuando isOpen=true: desliza hacia dentro. */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-40 transition-transform duration-200',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo "Siliba" a la izquierda + botón X para cerrar (solo móvil). */}
        {/* Logo + close button */}
        <div className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-gray-200">
          <span className="text-xl font-bold" style={{ color: '#008080' }}>Siliba</span>
          {/* lg:hidden: este botón solo aparece en móvil (en desktop el sidebar no se cierra). */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 -mr-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Cerrar menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Menú de navegación: lista de ítems con íconos, texto y badges.
            navItems.map((item) => ...): genera un <li> por cada elemento del menú. */}
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {visibleMenu.map((item) => {
              // isActive: true si la ruta actual coincide exactamente con el href,
              // O si la ruta comienza con el href (para sub-páginas como /employee/appointments/123).
              // Excepción: '/employee' solo se activa con coincidencia exacta (no startsWith),
              // para evitar que "Inicio" quede activo en todas las sub-páginas.
              const isActive = pathname === item.href || (item.href !== '/employee' && pathname.startsWith(item.href));
              // count: número de notificaciones sin leer para esta sección (0 si no tiene sección).
              const count = badgeFor(item.section);
              return (
                // key={item.href}: clave única basada en la URL (es única por diseño).
                <li key={item.href}>
                  {/* Link: navega a item.href al hacer click; también cierra el menú en móvil. */}
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      // Si está activo: fondo gris claro + texto oscuro. Si no: gris medio.
                      isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    )}
                  >
                    {/* Ícono SVG del ítem. Más oscuro si está activo. */}
                    <NavIcon d={item.icon} className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-gray-700' : 'text-gray-400')} />
                    {/* flex-1: el texto ocupa todo el espacio disponible (empuja el badge a la derecha). */}
                    <span className="flex-1">{item.label}</span>
                    {/* Badge de notificaciones: solo aparece si count > 0.
                        count > 99 ? '99+' : count: muestra "99+" si hay más de 99 notificaciones. */}
                    {count > 0 && (
                      <span
                        className="min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                        style={{ backgroundColor: '#dc2626' }}
                      >
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}

            {/* Botón "Mejora a PLUS": solo visible para tenants freelancer.
                isFreelancer && (...): si no es freelancer, no se renderiza nada.
                Aparece separado por una línea (border-t) del resto del menú. */}
            {/* Item destacado solo para freelancer (plan Pro): lleva a la
               comparativa Pro vs Plus + CTA de upgrade. */}
            {isFreelancer && (
              <li className="mt-3 pt-3 border-t border-gray-200">
                <Link
                  href="/employee/upgrade-to-plus"
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                    'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100',
                  )}
                >
                  <span className="w-5 h-5 flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z" />
                    </svg>
                  </span>
                  <span>Mejora a PLUS</span>
                </Link>
              </li>
            )}

            {/* Grupo "Administración": secciones admin concedidas al empleado
                (vía "Convertir en administrador"). Se muestran aquí mismo, dentro
                del perfil de empleado, en color ÍNDIGO para distinguirlas de las
                secciones propias. El dueño no las ve (usa el portal admin completo). */}
            {adminSections.length > 0 && (
              <li className="mt-3 pt-3 border-t border-gray-200">
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-400">
                  Administración
                </p>
                <ul className="space-y-1">
                  {adminSections.map((section) => {
                    const isActive = pathname === section.href || pathname.startsWith(section.href + '/');
                    return (
                      <li key={section.href}>
                        <Link
                          href={section.href}
                          onClick={onClose}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700',
                          )}
                        >
                          <NavIcon d={section.icon} className="w-5 h-5 flex-shrink-0 text-indigo-500" />
                          <span className="flex-1">{section.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            )}
          </ul>
        </nav>

        {/* Sección inferior con avatar + nombre + botón de logout.
            user && (...): solo se renderiza si hay usuario autenticado. */}
        {/* User section */}
        {user && (
          <div className="border-t border-gray-200 p-4">
            {/* Fila con avatar + nombre + email.
                Si isAdmin: hacer click en esta fila navega al dashboard de administrador (/home).
                window.location.href: navegación completa (recarga la página — necesario para
                cambiar de portal de empleado a portal de admin). */}
            <div
              className={`flex items-center gap-3 mb-3 ${isOwner ? 'cursor-pointer rounded-lg p-1.5 -m-1.5 hover:bg-gray-100 transition-colors' : ''}`}
              onClick={() => { if (isOwner) window.location.href = '/home'; }}
              title={isOwner ? 'Cambiar a Administrador' : undefined}
            >
              {/* Avatar: muestra foto si existe, o iniciales de lo contrario.
                  overflow-hidden: la imagen no se desborda del círculo.
                  `${API_URL}${user.avatarUrl}`: construye la URL completa de la foto. */}
              <div className="w-9 h-9 rounded-full bg-teal-50 text-[#008080] flex items-center justify-center text-sm font-semibold flex-shrink-0 overflow-hidden">
                {user.avatarUrl ? (
                  <img src={`${API_URL}${user.avatarUrl}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  getInitials(user.firstName, user.lastName)
                )}
              </div>
              <div className="min-w-0 flex-1">
                {/* truncate: corta el texto con "..." si es muy largo. */}
                <p className="text-sm font-medium text-gray-900 truncate">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              {/* Ícono de flechas de intercambio: solo el dueño puede cambiar de portal. */}
              {isOwner && (
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              )}
            </div>

            {/* Botón de cerrar sesión: llama a logout() (invalida tokens en BD)
                y luego usa window.location.replace('/login') para una navegación
                completa (no usa router.push para limpiar el estado de React). */}
            <button
              onClick={async () => {
                await logout();
                window.location.replace('/login');
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
