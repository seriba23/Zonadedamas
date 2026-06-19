'use client';

const CREATOR_TOKEN_KEY = 'creatorAccessToken';

export interface CreatorProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED';
  stripeOnboardingComplete: boolean;
}

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function getCreatorToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CREATOR_TOKEN_KEY);
}

export function setCreatorToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(CREATOR_TOKEN_KEY, token);
  else localStorage.removeItem(CREATOR_TOKEN_KEY);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getCreatorToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    setCreatorToken(null);
    if (typeof window !== 'undefined' && !path.includes('/auth/')) {
      window.location.href = '/creator/login';
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw { statusCode: res.status, message: err.message || res.statusText, ...err };
  }
  return res.json();
}

export const creatorApi = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
};

export async function creatorLogin(email: string, password: string) {
  const res = await creatorApi.post<{ data: { accessToken: string; influencer: CreatorProfile } }>(
    '/api/creator/auth/login',
    { email, password },
  );
  setCreatorToken(res.data.accessToken);
  return res.data;
}

export async function creatorRegister(body: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  password: string;
}) {
  const res = await creatorApi.post<{ data: any }>('/api/creator/auth/register', body);
  return res.data;
}

export async function creatorSetPassword(token: string, password: string) {
  const res = await creatorApi.post<{ data: { accessToken: string | null; influencer: CreatorProfile } }>(
    '/api/creator/auth/set-password',
    { token, password },
  );
  if (res.data.accessToken) setCreatorToken(res.data.accessToken);
  return res.data;
}

export async function creatorChangePassword(currentPassword: string, newPassword: string) {
  const res = await creatorApi.post<{ data: { changed: boolean } }>(
    '/api/creator/change-password',
    { currentPassword, newPassword },
  );
  return res.data;
}

export function creatorLogout() {
  setCreatorToken(null);
  if (typeof window !== 'undefined') window.location.href = '/creator/login';
}
