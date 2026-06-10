'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AuthProvider } from '@/lib/hooks/use-auth';
// Setup global de dayjs (extiende plugin utc + locale es). Debe importarse
// desde un Client Component porque el bundle del cliente es distinto al del
// server; el import del layout root solo afecta al render server-side y
// dejaba dayjs.utc undefined en pages con 'use client'.
import '@/lib/dayjs-setup';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 15, // 15 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
