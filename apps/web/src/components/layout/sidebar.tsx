'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  permission?: string;
}

const navItems: NavItem[] = [
  { label: 'Calendario', href: '/calendar', icon: '📅', permission: 'appointments.read' },
  { label: 'Clientes', href: '/clients', icon: '👥', permission: 'clients.read' },
  { label: 'Servicios', href: '/services', icon: '✂️', permission: 'services.read' },
  { label: 'Personal', href: '/staff', icon: '👤', permission: 'employees.read' },
  { label: 'Recursos', href: '/resources', icon: '🏠', permission: 'resources.read' },
  { label: 'POS', href: '/pos', icon: '💰', permission: 'payments.create' },
  { label: 'Reportes', href: '/reports', icon: '📊', permission: 'reports.revenue' },
  { label: 'Horarios', href: '/settings/hours', icon: '🕐', permission: 'tenant.update' },
  { label: 'Configuración', href: '/settings/roles', icon: '⚙️', permission: 'roles.read' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();

  const visibleItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-20">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <span className="text-xl font-bold text-primary-600">
          Zona de Damas
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
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
                      ? 'bg-primary-50 text-primary-700'
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
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {getInitials(user.firstName, user.lastName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
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
