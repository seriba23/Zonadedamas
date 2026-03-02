const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class MarketplaceApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('marketplace_refresh_token');
  }

  private setRefreshToken(token: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('marketplace_refresh_token', token);
  }

  private clearTokens() {
    this.accessToken = null;
    if (typeof window === 'undefined') return;
    localStorage.removeItem('marketplace_refresh_token');
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private async tryRefresh(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/marketplace/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          this.clearTokens();
          return false;
        }
        const json = await res.json();
        const data = json.data;
        this.accessToken = data.accessToken;
        this.setRefreshToken(data.refreshToken);
        return true;
      } catch {
        this.clearTokens();
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${BASE_URL}/api/marketplace${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && this.getRefreshToken()) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        res = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Error de red' }));
      throw new Error(err.message || `Error ${res.status}`);
    }

    return res.json();
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

  async uploadFile<T>(path: string, file: File, fieldName = 'file'): Promise<T> {
    const url = `${BASE_URL}/api/marketplace${path}`;
    const formData = new FormData();
    formData.append(fieldName, file);

    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let res = await fetch(url, { method: 'POST', headers, body: formData });

    if (res.status === 401 && this.getRefreshToken()) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        res = await fetch(url, { method: 'POST', headers, body: formData });
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Error de red' }));
      throw new Error(err.message || `Error ${res.status}`);
    }

    return res.json();
  }

  async loginAndStore(email: string, password: string) {
    const res: any = await this.post('/auth/login', { email, password });
    const data = res.data;
    this.accessToken = data.accessToken;
    this.setRefreshToken(data.refreshToken);
    return data.user;
  }

  async registerAndStore(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    const res: any = await this.post('/auth/register', params);
    const data = res.data;
    this.accessToken = data.accessToken;
    this.setRefreshToken(data.refreshToken);
    return data.user;
  }

  logout() {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      this.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    this.clearTokens();
  }

  isLoggedIn(): boolean {
    return !!this.getRefreshToken();
  }
}

export const marketplaceApi = new MarketplaceApiClient();
