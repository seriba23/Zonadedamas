'use client';

import { useAuth } from './use-auth';

export type TenantType = 'FREELANCER' | 'BUSINESS';

export function useTenantTier() {
  const { user } = useAuth();
  const tenantType = (user?.tenantType ?? null) as TenantType | null;
  const isFreelancer = tenantType === 'FREELANCER';
  const isPlus = tenantType === 'BUSINESS';
  return { isFreelancer, isPlus, tenantType };
}
