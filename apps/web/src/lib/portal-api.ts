'use client';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class PortalApiClient {
  private accessToken: string | null = null;
  private tenantSlug: string = '';
  private refreshPromise: Promise<boolean> | null = null;

  setTenantSlug(slug: string) {
    this.tenantSlug = slug;
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private get storageKey() {
    return `client_refresh_token_${this.tenantSlug}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const url = `${BASE_URL}/api/portal/${this.tenantSlug}${path}`;
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && this.accessToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        const retry = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!retry.ok) throw await this.handleError(retry);
        if (retry.status === 204) return {} as T;
        return retry.json();
      }
      throw new Error('Sesión expirada');
    }

    if (!res.ok) throw await this.handleError(res);
    if (res.status === 204) return {} as T;
    return res.json();
  }

  private async tryRefresh(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<boolean> {
    const refreshToken =
      typeof window !== 'undefined'
        ? localStorage.getItem(this.storageKey)
        : null;
    if (!refreshToken) return false;
    try {
      const res = await fetch(
        `${BASE_URL}/api/portal/${this.tenantSlug}/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        },
      );
      if (!res.ok) return false;
      const data = await res.json();
      this.accessToken = data.accessToken;
      localStorage.setItem(this.storageKey, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  private async handleError(res: Response) {
    const body = await res.json().catch(() => ({}));
    return {
      statusCode: res.status,
      message: body.message || res.statusText,
      ...body,
    };
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async upload<T>(path: string, file: File, extraFields?: Record<string, string>): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    if (extraFields) {
      for (const [key, value] of Object.entries(extraFields)) {
        formData.append(key, value);
      }
    }

    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const url = `${BASE_URL}/api/portal/${this.tenantSlug}${path}`;
    const res = await fetch(url, { method: 'POST', headers, body: formData });

    if (!res.ok) throw await this.handleError(res);
    return res.json();
  }
}

export const portalApi = new PortalApiClient();
