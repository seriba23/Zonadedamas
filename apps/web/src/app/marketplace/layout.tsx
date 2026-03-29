'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MarketplaceAuthProvider } from '@/lib/hooks/use-marketplace-auth';
import { useState } from 'react';
import { CompleteProfileGate } from './complete-profile-gate';
import { MarketplaceAuthGuard } from './auth-guard';
import { BottomNav } from './bottom-nav';

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <MarketplaceAuthProvider>
        <MarketplaceAuthGuard>
          <div className="min-h-screen bg-gray-50 pb-20">
            {children}
            <CompleteProfileGate />
          </div>
          <BottomNav />
        </MarketplaceAuthGuard>
      </MarketplaceAuthProvider>
    </QueryClientProvider>
  );
}
