'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function MarketplaceLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  useEffect(() => {
    const target = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login';
    router.replace(target);
  }, [router, redirect]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 border-[#008080] border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-gray-500">Redirigiendo al inicio de sesión…</p>
      </div>
    </div>
  );
}
