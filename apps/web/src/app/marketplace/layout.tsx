'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MarketplaceAuthProvider } from '@/lib/hooks/use-marketplace-auth';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { CompleteProfileGate } from './complete-profile-gate';
import { MarketplaceAuthGuard } from './auth-guard';
import { BottomNav } from './bottom-nav';
import { ForceLightTheme } from '@/components/ui/force-light-theme';

const AUTH_PATHS = ['/marketplace/login', '/marketplace/register'];

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  return (
    <>
      <div className={isAuthPage ? 'h-screen overflow-hidden bg-gray-50' : 'min-h-screen bg-gray-50 pb-20'}>
        {children}
        {!isAuthPage && <CompleteProfileGate />}
      </div>
      <BottomNav />
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
          <LayoutInner>{children}</LayoutInner>
        </MarketplaceAuthGuard>
      </MarketplaceAuthProvider>
    </QueryClientProvider>
  );
}
