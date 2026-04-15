'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TEAL = '#008080';

const tabs = [
  {
    href: '/marketplace',
    label: 'Negocios',
    matchPaths: ['/marketplace', '/marketplace/professionals'],
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill={active ? TEAL : 'none'} viewBox="0 0 24 24" strokeWidth={1.8} stroke={active ? TEAL : '#9ca3af'}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72" />
      </svg>
    ),
  },
  {
    href: '/marketplace/appointments',
    label: 'Citas',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke={active ? TEAL : '#9ca3af'}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    href: '/marketplace/coupons',
    label: 'Cupones',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke={active ? TEAL : '#9ca3af'}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    ),
  },
  {
    href: '/marketplace/profile',
    label: 'Perfil',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke={active ? TEAL : '#9ca3af'}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

const HIDDEN_PATHS = ['/marketplace/login', '/marketplace/register'];

export function BottomNav() {
  const pathname = usePathname();

  if (HIDDEN_PATHS.some((p) => pathname.startsWith(p))) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-bottom"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-2xl mx-auto flex items-center">
        {tabs.map((tab) => {
          const active = (tab as any).matchPaths
            ? (tab as any).matchPaths.some((p: string) => p === '/marketplace' ? pathname === p : pathname.startsWith(p))
            : tab.href === '/marketplace'
              ? pathname === '/marketplace'
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
            >
              {tab.icon(active)}
              <span
                className="text-[10px] font-medium"
                style={{ color: active ? TEAL : '#9ca3af' }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
