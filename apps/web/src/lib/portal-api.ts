// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO: portal-api.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cliente HTTP para el Portal del Cliente: la app que los clientes finales
// usan para ver y gestionar sus citas en un negocio concreto.
//
// Diferencia clave con otros portales:
//   - Cada negocio tiene su propio "slug" en la URL (ej. "salon-juanita").
//   - El refreshToken se guarda en localStorage bajo la llave
//     `client_refresh_token_<tenantSlug>`, una llave distinta por negocio.
//     Esto permite que un cliente tenga sesiones activas en varios negocios
//     simultáneamente sin que se interfieran.
//   - El accessToken se guarda solo en memoria (this.accessToken).
// ─────────────────────────────────────────────────────────────────────────────

// Directiva de Next.js 14: este módulo solo se ejecuta en el navegador.
'use client';

// URL base del backend. El || da un valor por defecto si la variable no existe.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─────────────────────────────────────────────────────────────────────────────
// CLASE: PortalApiClient
// ─────────────────────────────────────────────────────────────────────────────
class PortalApiClient {
  // accessToken: JWT en memoria. Se pierde si la página se recarga.
  private accessToken: string | null = null;
  // tenantSlug: slug del negocio activo (ej. "salon-juanita").
  // Se establece al montar el portal de un negocio concreto.
  private tenantSlug: string = '';
  // refreshPromise: evita peticiones de renovación duplicadas concurrentes.
  private refreshPromise: Promise<boolean> | null = null;

  // Establece el slug del negocio actual. Debe llamarse antes de hacer
  // cualquier petición, típicamente en el hook useClientAuth() al montarse.
  setTenantSlug(slug: string) {
    this.tenantSlug = slug;
  }

  // Guarda el accessToken en memoria. null = borrar la sesión.
  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  // ── PROPIEDAD CALCULADA: storageKey ───────────────────────────────────────
  // `get` define un "getter": parece una propiedad pero ejecuta código al leerla.
  // Ejemplo de valor: "client_refresh_token_salon-juanita"
  // Con esto cada negocio tiene su propia llave en localStorage.
  private get storageKey() {
    return `client_refresh_token_${this.tenantSlug}`;
  }

  // ── MÉTODO CENTRAL DE PETICIONES ─────────────────────────────────────────

  // Realiza una petición HTTP al portal del tenant activo.
  // La URL se construye como: BASE_URL/api/portal/<tenantSlug><path>
  // Por ejemplo: http://localhost:3001/api/portal/salon-juanita/appointments
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

    // URL dinámica que incluye el tenantSlug del negocio activo.
    const url = `${BASE_URL}/api/portal/${this.tenantSlug}${path}`;
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // ── 401: token expirado ───────────────────────────────────────────────────
    // Solo intentamos renovar si teníamos un accessToken (había sesión activa).
    if (res.status === 401 && this.accessToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        // Reintentamos con el nuevo accessToken.
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        const retry = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!retry.ok) throw await this.handleError(retry);
        // 204 No Content: respuesta vacía válida (ej. DELETE exitoso).
        // {} as T → objeto vacío casteado al tipo T para satisfacer TypeScript.
        if (retry.status === 204) return {} as T;
        return retry.json();
      }
      // No pudimos renovar: la sesión expiró definitivamente.
      throw new Error('Sesión expirada');
    }

    if (!res.ok) throw await this.handleError(res); // cualquier otro error HTTP
    if (res.status === 204) return {} as T;          // respuesta vacía exitosa
    return res.json();
  }

  // ── RENOVACIÓN DE TOKENS ──────────────────────────────────────────────────

  // Coordina la renovación: garantiza que no haya dos renovaciones en paralelo.
  // Si ya hay una promesa en vuelo, devuelve esa misma en lugar de crear otra.
  private async tryRefresh(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise; // ya hay una en curso
    this.refreshPromise = this.doRefresh();              // iniciamos la renovación
    try {
      return await this.refreshPromise;
    } finally {
      // `finally` siempre se ejecuta: limpiamos para la próxima vez.
      this.refreshPromise = null;
    }
  }

  // Realiza la petición de renovación al backend y actualiza los tokens.
  // Separada de tryRefresh() para mantener la lógica de "una sola promesa"
  // limpia y legible.
  private async doRefresh(): Promise<boolean> {
    // Leemos el refreshToken de la llave dinámica del localStorage.
    // El operador ternario inline verifica que estamos en el navegador.
    const refreshToken =
      typeof window !== 'undefined'
        ? localStorage.getItem(this.storageKey) // llave única por tenant
        : null;
    if (!refreshToken) return false; // sin refreshToken: no hay sesión que renovar
    try {
      // Petición al endpoint de renovación del portal del tenant concreto.
      const res = await fetch(
        `${BASE_URL}/api/portal/${this.tenantSlug}/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        },
      );
      if (!res.ok) return false; // el servidor rechazó el refreshToken
      const data = await res.json();
      // Guardamos los nuevos tokens (rotación: el servidor da un refreshToken nuevo).
      this.accessToken = data.accessToken;
      localStorage.setItem(this.storageKey, data.refreshToken);
      return true;
    } catch {
      return false; // error de red: asumimos fallo
    }
  }

  // ── MANEJO DE ERRORES HTTP ────────────────────────────────────────────────

  // Construye un objeto de error estructurado a partir de la respuesta HTTP.
  // Se usa con `throw await this.handleError(res)` para que el llamador
  // pueda capturar { statusCode, message, ...detalles }.
  private async handleError(res: Response) {
    // Intentamos parsear el cuerpo del error como JSON.
    // .catch(() => ({})) → si no es JSON válido, usamos objeto vacío.
    const body = await res.json().catch(() => ({}));
    return {
      statusCode: res.status,                       // código HTTP (ej. 404, 500)
      message: body.message || res.statusText,      // mensaje legible
      ...body,                                      // resto de propiedades del error del backend
    };
  }

  // ── MÉTODOS HTTP PÚBLICOS ─────────────────────────────────────────────────

  // Cada método delega en request() con el verbo HTTP correspondiente.
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

  // ── SUBIDA DE ARCHIVOS ────────────────────────────────────────────────────

  // Sube un archivo junto con campos adicionales opcionales.
  // Usa FormData (multipart/form-data) en lugar de JSON.
  //
  // Parámetros:
  //   path        → ruta del endpoint de subida
  //   file        → archivo a subir (ej. foto de perfil)
  //   extraFields → campos de texto adicionales a incluir en el formulario
  //                 (ej. { appointmentId: "abc123" }). Opcional.
  async upload<T>(path: string, file: File, extraFields?: Record<string, string>): Promise<T> {
    const formData = new FormData();
    formData.append('file', file); // añadimos el archivo bajo el nombre 'file'

    // Si hay campos adicionales, los añadimos uno a uno.
    // Object.entries(extraFields) → convierte { k: v } en [["k", "v"], ...]
    // for...of [key, value] → desestructuración: asignamos llave y valor en cada iteración
    if (extraFields) {
      for (const [key, value] of Object.entries(extraFields)) {
        formData.append(key, value); // añade cada campo extra al formulario
      }
    }

    // Solo la cabecera de autorización; el Content-Type lo pone el navegador.
    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const url = `${BASE_URL}/api/portal/${this.tenantSlug}${path}`;
    const res = await fetch(url, { method: 'POST', headers, body: formData });

    if (!res.ok) throw await this.handleError(res); // error: lanzamos excepción estructurada
    return res.json(); // éxito: devolvemos la respuesta del servidor
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCIA SINGLETON: portalApi
// ─────────────────────────────────────────────────────────────────────────────
// Una sola instancia compartida por toda la aplicación. El tenantSlug se
// actualiza dinámicamente según el negocio que el cliente esté visitando.
export const portalApi = new PortalApiClient();
