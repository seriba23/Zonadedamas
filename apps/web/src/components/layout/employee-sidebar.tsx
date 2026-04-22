'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { getInitials, cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface NavItem {
  label: string;
  href: string;
  icon: string; // SVG path
  mobileNav?: boolean; // show in bottom nav
}

const I = (d: string) => d;

const navItems: NavItem[] = [
  { label: 'Inicio', href: '/employee', icon: I('M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25'), mobileNav: true },
  { label: 'Mis Citas', href: '/employee/appointments', icon: I('M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5'), mobileNav: true },
  { label: 'Asistencia', href: '/employee/attendance', icon: I('M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z'), mobileNav: true },
  { label: 'Comisiones', href: '/employee/commissions', icon: I('M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z'), mobileNav: true },
  { label: 'Mi Perfil', href: '/employee/profile', icon: I('M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z'), mobileNav: true },
  { label: 'Reseñas', href: '/employee/reviews', icon: I('M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z') },
  { label: 'Galería', href: '/employee/gallery', icon: I('M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z') },
  { label: 'Mi Horario', href: '/employee/schedule', icon: I('M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z') },
  { label: 'Permisos', href: '/employee/time-off', icon: I('M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008z') },
  { label: 'Configuración', href: '/employee/settings', icon: I('M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z') },
];

const mobileNavItems = navItems.filter((item) => item.mobileNav);

export function EmployeeSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isAdmin = user?.permissions?.includes('employees.create');
  const moreItems = navItems.filter((item) => !item.mobileNav);
  const isMoreActive = moreItems.some((item) => pathname === item.href || pathname.startsWith(item.href));

  function NavIcon({ d, className }: { d: string; className?: string }) {
    return (
      <svg className={className || 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      </svg>
    );
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <span className="text-xl font-bold" style={{ color: '#008080' }}>Siliba</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/employee' && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  )}
                >
                  <NavIcon d={item.icon} className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-gray-700' : 'text-gray-400')} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      {user && (
        <div className="border-t border-gray-200 p-4">
          <div
            className={`flex items-center gap-3 mb-3 ${isAdmin ? 'cursor-pointer rounded-lg p-1.5 -m-1.5 hover:bg-gray-100 transition-colors' : ''}`}
            onClick={() => { if (isAdmin) window.location.href = '/home'; }}
            title={isAdmin ? 'Cambiar a Administrador' : undefined}
          >
            <div className="w-9 h-9 rounded-full bg-teal-50 text-[#008080] flex items-center justify-center text-sm font-semibold flex-shrink-0 overflow-hidden">
              {user.avatarUrl ? (
                <img src={`${API_URL}${user.avatarUrl}`} alt="" className="w-full h-full object-cover" />
              ) : (
                getInitials(user.firstName, user.lastName)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
            {isAdmin && (
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            )}
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex-col z-20">
        {sidebarContent}
      </aside>

      {/* Mobile bottom nav — horizontal scroll with arrow */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200">
        <div className="relative overflow-hidden" style={{ height: 56 }}>
          <div
            className="absolute inset-0 flex transition-transform duration-300 ease-in-out"
            style={{ transform: moreOpen ? 'translateX(-50%)' : 'translateX(0)', width: '200%' }}
          >
            {/* Page 1: main nav */}
            <div className="w-1/2 flex">
              {mobileNavItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/employee' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex-1 flex flex-col items-center py-2 text-xs transition-colors',
                      isActive ? 'text-[#008080]' : 'text-gray-400 hover:text-gray-600',
                    )}
                  >
                    <svg className="w-6 h-6 mb-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={isActive ? 2 : 1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    <span className={isActive ? 'font-medium' : ''}>{item.label}</span>
                  </Link>
                );
              })}
              {/* Arrow right */}
              <button
                onClick={() => setMoreOpen(true)}
                className={cn(
                  'w-12 flex items-center justify-center transition-colors',
                  isMoreActive ? 'text-[#008080]' : 'text-gray-400 hover:text-gray-600',
                )}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            {/* Page 2: more items */}
            <div className="w-1/2 flex">
              {/* Arrow left */}
              <button
                onClick={() => setMoreOpen(false)}
                className="w-12 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              {moreItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex-1 flex flex-col items-center py-2 text-xs transition-colors',
                      isActive ? 'text-[#008080]' : 'text-gray-400 hover:text-gray-600',
                    )}
                  >
                    <svg className="w-6 h-6 mb-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={isActive ? 2 : 1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    <span className={isActive ? 'font-medium' : ''}>{item.label}</span>
                  </Link>
                );
              })}
              {isAdmin && (
                <button
                  onClick={() => { setMoreOpen(false); window.location.href = '/home'; }}
                  className="flex-1 flex flex-col items-center py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6 mb-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Admin</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
