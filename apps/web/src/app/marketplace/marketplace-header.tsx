'use client';

import Link from 'next/link';
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';
import { Avatar } from '@/components/ui/avatar';

export default function MarketplaceHeader() {
  const { user, isAuthenticated, isLoading } = useMarketplaceAuth();

  return (
    <div className="bg-white border-b border-gray-200 px-4 pt-3 pb-3 safe-top">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <Link href="/marketplace">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#008080' }}>Siliba</h1>
          <p className="text-xs text-gray-500">Tu confianza, en manos de profesionales</p>
        </Link>

        {isLoading ? null : isAuthenticated ? (
          <Link
            href="/marketplace/profile"
            className="flex items-center gap-2 text-sm text-gray-700"
          >
            <Avatar
              avatarUrl={user?.avatarUrl}
              firstName={user?.firstName}
              lastName={user?.lastName}
              className="w-8 h-8"
            />
          </Link>
        ) : (
          <Link
            href="/marketplace/login"
            className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: '#008080' }}
          >
            Iniciar sesion
          </Link>
        )}
      </div>
    </div>
  );
}
