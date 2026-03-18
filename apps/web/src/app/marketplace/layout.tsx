'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MarketplaceAuthProvider } from '@/lib/hooks/use-marketplace-auth';
import { useState } from 'react';
import { CompleteProfileGate } from './complete-profile-gate';

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <MarketplaceAuthProvider>
        <div className="min-h-screen bg-gray-50">
          {children}
          <CompleteProfileGate />
        </div>
      </MarketplaceAuthProvider>
    </QueryClientProvider>
  );
}
