export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string | null;
  logoUrl?: string | null;
  timezone: string;
  currency: string;
  settings: Record<string, unknown>;
  subscriptionPlan: string;
  subscriptionStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  tenantId: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  timezone?: string | null;
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  email: string;
  timezone?: string;
  currency?: string;
  owner: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateLocationRequest {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone?: string;
}

export type UpdateLocationRequest = Partial<CreateLocationRequest>;
