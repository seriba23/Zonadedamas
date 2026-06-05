'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MarketplaceAuthProvider } from '@/lib/hooks/use-marketplace-auth';
import { useState, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { CompleteProfileGate } from './complete-profile-gate';
import { MarketplaceAuthGuard } from './auth-guard';
import { BottomNav } from './bottom-nav';
import { ForceLightTheme } from '@/components/ui/force-light-theme';

const AUTH_PATHS = ['/marketplace/login', '/marketplace/register'];

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));
  // Modo preview admin: sin bottom nav, sin padding inferior, sin gate de
  // perfil incompleto (el admin ya no necesita completar su perfil cliente).
  const fromAdmin = searchParams.get('fromAdmin') === '1';

  return (
    <>
      <div className={isAuthPage ? 'h-screen overflow-hidden bg-gray-50' : `min-h-screen bg-gray-50 ${fromAdmin ? '' : 'pb-20'}`}>
        {children}
        {!isAuthPage && !fromAdmin && <CompleteProfileGate />}
      </div>
      {!fromAdmin && <BottomNav />}
    </>
  );
}

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ForceLightTheme />
      <MarketplaceAuthProvider>
        <MarketplaceAuthGuard>
          {/* Suspense necesario porque LayoutInner usa useSearchParams
              (fromAdmin) y eso obliga a opt-out de prerender estatico.
              Sin Suspense, /marketplace/login y /register fallan al build. */}
          <Suspense fallback={null}>
            <LayoutInner>{children}</LayoutInner>
          </Suspense>
        </MarketplaceAuthGuard>
      </MarketplaceAuthProvider>
    </QueryClientProvider>
  );
}
