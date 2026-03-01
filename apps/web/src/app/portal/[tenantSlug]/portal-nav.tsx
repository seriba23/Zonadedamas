'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useClientAuth } from '@/lib/hooks/use-client-auth';

const NAV_ITEMS = [
  { label: 'Citas', path: 'appointments', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { label: 'Historial', path: 'history', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Reservar', path: 'book', icon: 'M12 4v16m8-8H4' },
  { label: 'Perfil', path: 'profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

export default function PortalNav() {
  const pathname = usePathname();
  const { tenantSlug } = useClientAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-lg mx-auto flex">
        {NAV_ITEMS.map((item) => {
          const href = `/portal/${tenantSlug}/${item.path}`;
          const isActive = pathname.includes(`/${item.path}`);

          return (
            <Link
              key={item.path}
              href={href}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                isActive
                  ? 'text-indigo-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <svg
                className="w-6 h-6 mb-0.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={isActive ? 2 : 1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span className={isActive ? 'font-medium' : ''}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
