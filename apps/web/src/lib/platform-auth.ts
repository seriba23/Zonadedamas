// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO: platform-auth.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cliente HTTP y helpers de autenticación para el portal de SuperAdmin
// (administrador de toda la plataforma Siliba, no de un negocio individual).
//
// Diferencia con otros portales:
//   - El accessToken se guarda en sessionStorage (no en memoria como marketplace):
//     persiste si el usuario recarga, pero desaparece al cerrar la pestaña.
//   - El refreshToken se guarda en localStorage (persiste entre sesiones).
//   - Solo existe un rol posible: 'platform_admin'.
// ─────────────────────────────────────────────────────────────────────────────

// `api` es el cliente HTTP del dashboard de negocio/staff. En este archivo
// solo se importa para tenerlo disponible si se necesitara, aunque la clase
// PlatformApiClient tiene su propia lógica de fetch independiente.
import { api } from './api';

// Llaves (keys) usadas en el almacenamiento del navegador.
// Tenerlas como constantes evita errores de tipeo al referenciarlas.
const PLATFORM_TOKEN_KEY = 'platformRefreshToken';  // llave en localStorage
const PLATFORM_ACCESS_KEY = 'platformAccessToken';  // llave en sessionStorage

// ─────────────────────────────────────────────────────────────────────────────
// INTERFAZ: PlatformUser
// ─────────────────────────────────────────────────────────────────────────────
// Describe el perfil del administrador de plataforma autenticado.
// Solo tiene un rol posible ('platform_admin'), expresado como literal de string.
export interface PlatformUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'platform_admin'; // único valor permitido (no hay otros roles en este portal)
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERFAZ: PlatformAuthTokens
// ─────────────────────────────────────────────────────────────────────────────
// Respuesta que devuelve el backend tras un login exitoso. Contiene ambos
// tokens y los datos del usuario en un solo objeto.
export interface PlatformAuthTokens {
  accessToken: string;   // JWT de corta duración
  refreshToken: string;  // token de larga duración para renovar el access
  user: PlatformUser;    // perfil del admin
}

// ─────────────────────────────────────────────────────────────────────────────
// CLASE: PlatformApiClient
// ─────────────────────────────────────────────────────────────────────────────
// Cliente HTTP dedicado al portal de SuperAdmin. Funciona igual que
// MarketplaceApiClient (mismo patrón de refresh automático), pero almacena
// el accessToken en sessionStorage en lugar de solo en memoria.
// Separate API client for platform (reuses same base but different token management)
class PlatformApiClient {
  // `baseUrl`: URL del backend. Se inicializa en el constructor.
  private baseUrl: string;
  // `accessToken`: copia en memoria del accessToken. Se sincroniza con
  // sessionStorage en setAccessToken() y se recupera en getAccessToken().
  private accessToken: string | null = null;

  // El constructor se ejecuta cuando se hace `new PlatformApiClient()`.
  // Lee la URL del backend desde las variables de entorno.
  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  // Guarda el accessToken tanto en memoria como en sessionStorage.
  // Si `token` es null, lo borra de ambos lugares (logout).
  // sessionStorage persiste en recargas de página pero no entre pestañas.
  setAccessToken(token: string | null) {
    this.accessToken = token; // en memoria
    if (typeof window !== 'undefined') { // guardamos en sessionStorage solo en el navegador
      if (token) {
        sessionStorage.setItem(PLATFORM_ACCESS_KEY, token);  // guardar
      } else {
        sessionStorage.removeItem(PLATFORM_ACCESS_KEY);       // borrar
      }
    }
  }

  // Devuelve el accessToken. Intenta primero la memoria, luego sessionStorage.
  // Esto garantiza que funcione después de recargar la página (cuando la
  // variable en memoria es null pero sessionStorage aún tiene el valor).
  getAccessToken(): string | null {
    if (this.accessToken) return this.accessToken; // ya lo tenemos en memoria
    if (typeof window !== 'undefined') {
      // Recuperamos de sessionStorage y también actualizamos la memoria.
      this.accessToken = sessionStorage.getItem(PLATFORM_ACCESS_KEY);
    }
    return this.accessToken;
  }

  // ── MÉTODO CENTRAL DE PETICIONES HTTP ────────────────────────────────────

  // Realiza una petición HTTP autenticada al backend.
  // Si recibe 401 y el refresh funciona, reintenta la petición.
  // Si el refresh falla, redirige al login del panel de plataforma.
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = this.getAccessToken(); // leer token actual (memoria o sessionStorage)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`; // añadir autorización si hay token
    }

    // Primera petición al servidor.
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // ── 401: token expirado ───────────────────────────────────────────────────
    // Solo intentamos renovar si teníamos un token (había sesión).
    if (res.status === 401 && token) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        // Renovación exitosa: actualizamos cabecera y repetimos la petición.
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        const retry = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!retry.ok) {
          const err = await retry.json().catch(() => ({}));
          // `...err` propaga todas las propiedades del error del servidor.
          throw { statusCode: retry.status, message: err.message || retry.statusText, ...err };
        }
        return retry.json(); // éxito en el reintento
      }
      // No se pudo renovar: sesión definitivamente expirada → redirigir al login.
      if (typeof window !== 'undefined') {
        window.location.href = '/platform/login'; // redirección dura al login de plataforma
      }
      throw new Error('Sesión expirada'); // también lanzamos error por si alguien lo captura
    }

    // ── Cualquier otro error HTTP ────────────────────────────────────────────
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw { statusCode: res.status, message: err.message || res.statusText, ...err };
    }
    return res.json(); // éxito: devolvemos el JSON parseado
  }

  // ── RENOVACIÓN DE TOKENS ──────────────────────────────────────────────────

  // Usa el refreshToken de localStorage para obtener un nuevo accessToken.
  // El operador ternario inline lee de localStorage solo si hay window.
  private async tryRefresh(): Promise<boolean> {
    const refreshToken = typeof window !== 'undefined'
      ? localStorage.getItem(PLATFORM_TOKEN_KEY) // en navegador: leer de localStorage
      : null;                                     // en servidor SSR: null
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${this.baseUrl}/api/platform/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false; // token inválido o caducado: no pudimos renovar
      const data = await res.json();
      // Guardamos el nuevo accessToken (mediante setAccessToken para que
      // también actualice sessionStorage).
      this.setAccessToken(data.data.accessToken);
      // El backend rota el refreshToken: guardamos el nuevo en localStorage.
      localStorage.setItem(PLATFORM_TOKEN_KEY, data.data.refreshToken);
      return true;
    } catch {
      return false; // error de red: asumimos fallo silencioso
    }
  }

  // ── MÉTODOS HTTP ABREVIADOS ───────────────────────────────────────────────
  // Cada uno delega en request() con el verbo correspondiente.
  // Se escriben en una sola línea porque son triviales.

  get<T>(path: string): Promise<T> { return this.request<T>('GET', path); }
  post<T>(path: string, body?: unknown): Promise<T> { return this.request<T>('POST', path, body); }
  // patch: actualización PARCIAL (solo los campos enviados, no el objeto completo).
  patch<T>(path: string, body?: unknown): Promise<T> { return this.request<T>('PATCH', path, body); }
  delete<T>(path: string): Promise<T> { return this.request<T>('DELETE', path); }
}

// Instancia singleton exportada: todos los archivos importan el mismo objeto.
export const platformApi = new PlatformApiClient();

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: platformLogin
// ─────────────────────────────────────────────────────────────────────────────
// Inicia sesión del administrador de plataforma.
//
// Parámetros: email y password.
// Devuelve: Promise<PlatformAuthTokens> con ambos tokens y el perfil.
//
// Tras el login:
//   - accessToken  → guardado en sesión (setAccessToken → sessionStorage)
//   - refreshToken → guardado en localStorage (persiste entre sesiones)
export async function platformLogin(email: string, password: string): Promise<PlatformAuthTokens> {
  const res = await platformApi.post<{ data: PlatformAuthTokens }>('/api/platform/auth/login', { email, password });
  platformApi.setAccessToken(res.data.accessToken);             // guarda en memoria y sessionStorage
  localStorage.setItem(PLATFORM_TOKEN_KEY, res.data.refreshToken); // guarda refreshToken
  return res.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: platformLogout
// ─────────────────────────────────────────────────────────────────────────────
// Cierra la sesión del administrador de plataforma.
//
// Devuelve: Promise<void> (no hay valor de retorno útil).
//
// Flujo:
//   1. Lee el refreshToken actual (para enviarlo al backend).
//   2. Borra el accessToken (memoria + sessionStorage).
//   3. Borra el refreshToken de localStorage.
//   4. Notifica al backend para que invalide el refreshToken (best-effort).
export async function platformLogout(): Promise<void> {
  const refreshToken = localStorage.getItem(PLATFORM_TOKEN_KEY);
  platformApi.setAccessToken(null);                     // borra accessToken
  localStorage.removeItem(PLATFORM_TOKEN_KEY);          // borra refreshToken
  if (refreshToken) {
    // Intentamos invalidar en el servidor. Si falla (sin red), no importa:
    // los tokens locales ya fueron borrados y el refreshToken caducará solo.
    platformApi.post('/api/platform/auth/logout', { refreshToken }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: platformGetMe
// ─────────────────────────────────────────────────────────────────────────────
// Obtiene el perfil del administrador actualmente autenticado.
// Devuelve: Promise<{ data: PlatformUser }>
// Requiere tener un accessToken válido (o refreshToken para renovarlo).
export async function platformGetMe(): Promise<{ data: PlatformUser }> {
  return platformApi.get<{ data: PlatformUser }>('/api/platform/auth/me');
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: hasPlatformRefreshToken
// ─────────────────────────────────────────────────────────────────────────────
// Comprueba si hay un refreshToken de plataforma en localStorage.
// Útil para saber si hay sesión activa sin hacer una petición al servidor.
//
// Devuelve: boolean → true si hay token, false si no.
// !! convierte el string (o null) a boolean. null → false, "token..." → true.
export function hasPlatformRefreshToken(): boolean {
  if (typeof window === 'undefined') return false; // seguridad en SSR
  return !!localStorage.getItem(PLATFORM_TOKEN_KEY);
}
