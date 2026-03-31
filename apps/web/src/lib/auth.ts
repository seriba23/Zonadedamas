import { api } from './api';

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  permissions: string[];
  employeeId?: string | null;
  isEmployeeActive?: boolean;
  tenantName?: string;
  subscriptionStatus?: string;
  subscriptionPlan?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthTokens> {
  const res = await api.post<{ data: AuthTokens }>('/api/auth/login', {
    email,
    password,
  });
  api.setAccessToken(res.data.accessToken);
  localStorage.setItem('refreshToken', res.data.refreshToken);
  return res.data;
}

export interface RegisterParams {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  inviteCode?: string;
  type?: 'business' | 'individual';
  businessName?: string;
  businessType?: string;
  businessAddress?: string;
  businessPhone?: string;
  selectedPlan?: string;
  acceptContract?: boolean;
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
