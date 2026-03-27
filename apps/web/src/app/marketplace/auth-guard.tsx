'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';

const PUBLIC_PATHS = [
  '/marketplace/login',
  '/marketplace/register',
  '/marketplace/forgot-password',
];

export function MarketplaceAuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useMarketplaceAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicPath) {
      router.replace(`/marketplace/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, isPublicPath, pathname, router]);

  if (isPublicPath) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-[#008080] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
