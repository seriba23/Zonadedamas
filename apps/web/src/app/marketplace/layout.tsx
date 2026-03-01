'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MarketplaceAuthProvider } from '@/lib/hooks/use-marketplace-auth';
import { useState } from 'react';

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <MarketplaceAuthProvider>
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </MarketplaceAuthProvider>
    </QueryClientProvider>
  );
}
