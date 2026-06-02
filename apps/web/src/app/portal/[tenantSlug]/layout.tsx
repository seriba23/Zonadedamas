'use client';

import { useParams } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientAuthProvider } from '@/lib/hooks/use-client-auth';
import { useState } from 'react';
import { ForceLightTheme } from '@/components/ui/force-light-theme';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const tenantSlug = params.tenantSlug as string;
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ForceLightTheme />
      <ClientAuthProvider tenantSlug={tenantSlug}>
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </ClientAuthProvider>
    </QueryClientProvider>
  );
}
