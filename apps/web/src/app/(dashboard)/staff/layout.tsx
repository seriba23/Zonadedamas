'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTenantTier } from '@/lib/hooks/use-tenant-tier';

export default function StaffLayout({ children }: { children: ReactNode }) {
  const { isFreelancer } = useTenantTier();
  const router = useRouter();

  useEffect(() => {
    if (isFreelancer) {
      router.replace('/upgrade-to-plus');
    }
  }, [isFreelancer, router]);

  if (isFreelancer) return null;
  return <>{children}</>;
}
