import { api } from './api';

const PLATFORM_TOKEN_KEY = 'platformRefreshToken';
const PLATFORM_ACCESS_KEY = 'platformAccessToken';

export interface PlatformUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'platform_admin';
}

export interface PlatformAuthTokens {
  accessToken: string;
  refreshToken: string;
  user: PlatformUser;
}

// Separate API client for platform (reuses same base but different token management)
class PlatformApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        sessionStorage.setItem(PLATFORM_ACCESS_KEY, token);
      } else {
        sessionStorage.removeItem(PLATFORM_ACCESS_KEY);
      }
    }
  }

  getAccessToken(): string | null {
    if (this.accessToken) return this.accessToken;
    if (typeof window !== 'undefined') {
      this.accessToken = sessionStorage.getItem(PLATFORM_ACCESS_KEY);
    }
    return this.accessToken;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && token) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        const retry = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!retry.ok) {
          const err = await retry.json().catch(() => ({}));
          throw { statusCode: retry.status, message: err.message || retry.statusText, ...err };
        }
        return retry.json();
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/platform/login';
      }
      throw new Error('Sesión expirada');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw { statusCode: res.status, message: err.message || res.statusText, ...err };
    }
    return res.json();
  }

  private async tryRefresh(): Promise<boolean> {
    const refreshToken = typeof window !== 'undefined'
      ? localStorage.getItem(PLATFORM_TOKEN_KEY)
      : null;
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${this.baseUrl}/api/platform/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.setAccessToken(data.data.accessToken);
      localStorage.setItem(PLATFORM_TOKEN_KEY, data.data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  get<T>(path: string): Promise<T> { return this.request<T>('GET', path); }
  post<T>(path: string, body?: unknown): Promise<T> { return this.request<T>('POST', path, body); }
  patch<T>(path: string, body?: unknown): Promise<T> { return this.request<T>('PATCH', path, body); }
}

export const platformApi = new PlatformApiClient();

export async function platformLogin(email: string, password: string): Promise<PlatformAuthTokens> {
  const res = await platformApi.post<{ data: PlatformAuthTokens }>('/api/platform/auth/login', { email, password });
  platformApi.setAccessToken(res.data.accessToken);
  localStorage.setItem(PLATFORM_TOKEN_KEY, res.data.refreshToken);
  return res.data;
}

export async function platformLogout(): Promise<void> {
  const refreshToken = localStorage.getItem(PLATFORM_TOKEN_KEY);
  platformApi.setAccessToken(null);
  localStorage.removeItem(PLATFORM_TOKEN_KEY);
  if (refreshToken) {
    platformApi.post('/api/platform/auth/logout', { refreshToken }).catch(() => {});
  }
}

export async function platformGetMe(): Promise<{ data: PlatformUser }> {
  return platformApi.get<{ data: PlatformUser }>('/api/platform/auth/me');
}

export function hasPlatformRefreshToken(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(PLATFORM_TOKEN_KEY);
}
