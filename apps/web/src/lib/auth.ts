import { api } from './api';
import { marketplaceApi } from './marketplace-api';

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  permissions: string[];
  isAdmin?: boolean;
  employeeId?: string | null;
  isEmployeeActive?: boolean;
  jobTitle?: string | null;
  tenantName?: string;
  tenantCurrency?: string;
  subscriptionStatus?: string;
  subscriptionPlan?: string;
  trialEndsAt?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface UnifiedLoginResult {
  // legacy flat (business). null if user is client-only.
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  // unified
  business: { accessToken: string; refreshToken: string; user: AuthUser } | null;
  client: { accessToken: string; refreshToken: string; user: any } | null;
  profiles: Array<'admin' | 'professional' | 'client'>;
}

export async function login(
  email: string,
  password: string,
): Promise<UnifiedLoginResult> {
  const res = await api.post<{ data: UnifiedLoginResult }>('/api/auth/login', {
    email,
    password,
  });
  const data = res.data;

  // Persist business session (legacy flat fields)
  if (data.accessToken && data.refreshToken) {
    api.setAccessToken(data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
  }

  // Persist client session if user has client profile
  if (data.client?.accessToken && data.client?.refreshToken) {
    marketplaceApi.setSession(data.client.accessToken, data.client.refreshToken);
  }

  return data;
}

export interface RegisterParams {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  inviteCode?: string;
  type?: 'business' | 'individual' | 'freelancer';
  businessName?: string;
  businessTypes?: string[];
  businessType?: string; // legacy
  businessStreet?: string;
  businessCity?: string;
  businessState?: string;
  businessPostalCode?: string;
  businessCountry?: string;
  businessAddress?: string; // legacy
  businessPhone?: string;
  selectedPlan?: string;
  acceptContract?: boolean;
  acceptPrivacy?: boolean;
}

export async function register(params: RegisterParams): Promise<AuthTokens> {
  const res = await api.post<{ data: AuthTokens }>('/api/auth/register', params);
  api.setAccessToken(res.data.accessToken);
  localStorage.setItem('refreshToken', res.data.refreshToken);
  return res.data;
}

export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem('refreshToken');
  // Clear local session immediately (no waiting)
  api.setAccessToken(null);
  localStorage.removeItem('refreshToken');
  // Revoke token on backend in the background
  if (refreshToken) {
    api.post('/api/auth/logout', { refreshToken }).catch(() => {});
  }
}

export async function getMe(): Promise<{ data: AuthUser }> {
  return api.get<{ data: AuthUser }>('/api/auth/me');
}

export function hasRefreshToken(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('refreshToken');
}

export function restoreSession(): boolean {
  const refreshToken = localStorage.getItem('refreshToken');
  return !!refreshToken;
}
