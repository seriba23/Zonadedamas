'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface NavChild {
  label: string;
  href: string;
  permission?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  permission?: string;
  children?: NavChild[];
}

const navItems: NavItem[] = [
  { label: 'Inicio', href: '/dashboard', icon: '🏠' },
  { label: 'Reportes', href: '/reports', icon: '📊', permission: 'reports.revenue' },
  { label: 'Calendario', href: '/calendar', icon: '📅', permission: 'appointments.read' },
  { label: 'Clientes', href: '/clients', icon: '👥', permission: 'clients.read' },
  { label: 'Servicios', href: '/services', icon: '✂️', permission: 'services.read' },
  { label: 'Paquetes', href: '/bundles', icon: '📋', permission: 'services.read' },
  { label: 'Recompensas', href: '/rewards', icon: '🎁', permission: 'rewards.read' },
  { label: 'Promociones', href: '/promotions', icon: '🏷️', permission: 'promotions.read' },
  { label: 'Personal', href: '/staff', icon: '👤', permission: 'employees.read' },
  { label: 'Recursos', href: '/resources', icon: '🏠', permission: 'resources.read' },
  { label: 'Inventario', href: '/inventory', icon: '📦', permission: 'inventory.read' },
  { label: 'Proveedores', href: '/suppliers', icon: '🚚', permission: 'inventory.read' },
  { label: 'POS', href: '/pos', icon: '💰', permission: 'payments.create' },
  { label: 'Mi Negocio', href: '/settings/business', icon: '🏪', permission: 'tenant.update' },
  { label: 'Sucursales', href: '/settings/locations', icon: '📍', permission: 'locations.read' },
  { label: 'Pagos Online', href: '/settings/payments', icon: '💳', permission: 'tenant.update' },
  { label: 'Suscripción', href: '/settings/subscription', icon: '⭐', permission: 'tenant.update' },
  {
    label: 'Horarios',
    href: '/settings/hours',
    icon: '🕐',
    permission: 'tenant.update',
    children: [
      { label: 'Negocio', href: '/settings/hours' },
      { label: 'Empleados', href: '/settings/hours/employees' },
    ],
  },
  { label: 'Invitaciones', href: '/settings/invite-codes', icon: '🔑', permission: 'tenant.update' },
  { label: 'Código QR', href: '/settings/qr', icon: '📱', permission: 'tenant.read' },
  { label: 'Notificaciones', href: '/settings/notifications', icon: '🔔', permission: 'notifications.manage' },
  { label: 'Configuración', href: '/settings/roles', icon: '⚙️', permission: 'roles.read' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();

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
    <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-20">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <span className="text-xl font-bold text-primary-600">
          Siliba
        </span>
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
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    )}
                  >
                    <span className="text-lg leading-none">{item.icon}</span>
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
                              className={cn(
                                'block px-3 py-2 rounded-lg text-sm transition-colors',
                                isActive
                                  ? 'bg-gray-100 text-gray-900 font-medium'
                                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
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

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  )}
                >
                  <span className="text-lg leading-none">{item.icon}</span>
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
            className={`flex items-center gap-3 mb-3 ${user.employeeId ? 'cursor-pointer rounded-lg p-1.5 -m-1.5 hover:bg-gray-100 transition-colors' : ''}`}
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
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
            {user.employeeId && (
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            )}
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
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
  );
}
