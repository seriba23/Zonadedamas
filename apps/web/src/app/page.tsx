'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated && user) {
      const isAdmin = user.isAdmin === true || user.permissions?.includes('employees.create');
      router.replace(isAdmin ? '/home' : '/employee');
    } else {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, user, router]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 border-[#008080] border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-gray-500">Redirigiendo…</p>
      </div>
    </div>
  );
}
