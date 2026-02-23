export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
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

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && this.accessToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        const retry = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!retry.ok) throw await this.handleError(retry);
        if (retry.status === 204) return {} as T;
        return retry.json();
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Sesión expirada');
    }

    if (!res.ok) throw await this.handleError(res);
    if (res.status === 204) return {} as T;
    return res.json();
  }

  private async tryRefresh(): Promise<boolean> {
    // Singleton: avoid multiple parallel refresh calls
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

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
        ? localStorage.getItem('refreshToken')
        : null;
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.accessToken = data.data.accessToken;
      localStorage.setItem('refreshToken', data.data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  private async handleError(res: Response): Promise<ApiError> {
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

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async uploadForm<T>(
    path: string,
    fields: Record<string, string>,
    file?: File,
  ): Promise<T> {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }
    if (file) {
      formData.append('file', file);
    }

    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (res.status === 401 && this.accessToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        const retry = await fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers,
          body: formData,
        });
        if (!retry.ok) throw await this.handleError(retry);
        return retry.json();
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Sesión expirada');
    }

    if (!res.ok) throw await this.handleError(res);
    return res.json();
  }

  async upload<T>(
    path: string,
    file: File,
    extraFields?: Record<string, string>,
  ): Promise<T> {
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
    // Do NOT set Content-Type — browser generates it with boundary

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (res.status === 401 && this.accessToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        const retry = await fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers,
          body: formData,
        });
        if (!retry.ok) throw await this.handleError(retry);
        return retry.json();
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('Sesión expirada');
    }

    if (!res.ok) throw await this.handleError(res);
    return res.json();
  }
}

export const api = new ApiClient();
