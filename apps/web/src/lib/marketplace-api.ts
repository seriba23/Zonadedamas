// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO: marketplace-api.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cliente HTTP para el portal de Marketplace (usuarios finales que buscan y
// reservan en negocios). Implementado como una CLASE para poder guardar el
// token de acceso como estado interno (this.accessToken), lo que evita
// pasarlo como parámetro en cada llamada.
//
// Sistema de tokens:
//   accessToken  → JWT de corta duración (15 min), guardado solo en memoria
//                  (this.accessToken). Se pierde al recargar la página.
//   refreshToken → token de larga duración (30 días), guardado en localStorage
//                  bajo la llave 'marketplace_refresh_token'. Persiste aunque
//                  se recargue la página.
//
// Flujo de renovación automática:
//   Si una petición devuelve 401 (token expirado), se llama a tryRefresh()
//   que usa el refreshToken para obtener nuevos tokens del backend. Si tiene
//   éxito, se reintenta la petición original con el nuevo accessToken.
// ─────────────────────────────────────────────────────────────────────────────

// URL base del backend. El || actúa de fallback si la variable de entorno
// no está definida en el archivo .env.local.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─────────────────────────────────────────────────────────────────────────────
// CLASE: MarketplaceApiClient
// ─────────────────────────────────────────────────────────────────────────────
// Una clase es una "plantilla" para crear objetos con datos (propiedades) y
// comportamiento (métodos). Al final del archivo creamos una sola instancia
// (`marketplaceApi`) que se reutiliza en toda la aplicación.
class MarketplaceApiClient {
  // Propiedades privadas (`private`): solo accesibles dentro de la clase.
  // `accessToken`: token JWT en memoria. null = no autenticado.
  private accessToken: string | null = null;
  // `refreshPromise`: evita que si dos peticiones fallan con 401 al mismo
  // tiempo se lancen DOS peticiones de renovación. La segunda espera a la primera.
  private refreshPromise: Promise<boolean> | null = null;

  // ── GESTIÓN DEL REFRESH TOKEN (localStorage) ──────────────────────────────

  // Lee el refreshToken del localStorage. Si estamos en el servidor (SSR),
  // localStorage no existe y devuelve null de forma segura.
  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('marketplace_refresh_token');
  }

  // Guarda el refreshToken en localStorage.
  private setRefreshToken(token: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('marketplace_refresh_token', token);
  }

  // Borra AMBOS tokens: el accessToken en memoria y el refreshToken en localStorage.
  // Se llama cuando la sesión no puede renovarse (token caducado o inválido).
  private clearTokens() {
    this.accessToken = null;
    if (typeof window === 'undefined') return;
    localStorage.removeItem('marketplace_refresh_token');
  }

  // ── MÉTODOS PÚBLICOS DE GESTIÓN DE TOKENS ─────────────────────────────────

  // Guarda el accessToken en memoria. Llamado después de login o refresh.
  setAccessToken(token: string) {
    this.accessToken = token;
  }

  // Guarda AMBOS tokens de una vez. Llamado típicamente al hacer login.
  setSession(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.setRefreshToken(refreshToken);
    // Sesión NUEVA (login fresco): olvidamos el perfil activo guardado para que
    // el marketplace muestre SIEMPRE el selector de perfiles tras iniciar sesión.
    // (No se llama en el refresh automático de token, así que las recargas dentro
    // de la misma sesión sí conservan el perfil elegido.)
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem('marketplace_active_profile_id'); } catch {}
    }
  }

  // Devuelve el accessToken actual. Puede ser null si no hay sesión activa.
  getAccessToken(): string | null {
    return this.accessToken;
  }

  // ── RENOVACIÓN AUTOMÁTICA DE TOKENS ───────────────────────────────────────

  // Intenta renovar el accessToken usando el refreshToken guardado.
  // Devuelve Promise<boolean>: true si la renovación fue exitosa, false si no.
  //
  // Patrón "promesa compartida": si ya hay una renovación en curso
  // (this.refreshPromise no es null), devuelve esa misma promesa en lugar
  // de hacer otra petición. Así evitamos peticiones duplicadas.
  private async tryRefresh(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false; // sin refreshToken: imposible renovar

    // Si ya hay una renovación en curso, reutilizamos esa promesa.
    if (this.refreshPromise) return this.refreshPromise;

    // Creamos y guardamos la promesa de renovación.
    // La función async IIFE (Immediately Invoked Function Expression)
    // "(async () => { ... })()" crea y ejecuta una función async al instante,
    // devolviendo su promesa para que la guardemos en this.refreshPromise.
    this.refreshPromise = (async () => {
      try {
        // Hacemos el POST al endpoint de renovación.
        const res = await fetch(`${BASE_URL}/api/marketplace/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          // Si el servidor rechazó el refreshToken, borramos todo y rendimos.
          this.clearTokens();
          return false;
        }
        const json = await res.json();
        const data = json.data; // el backend devuelve { data: { accessToken, refreshToken } }
        // Guardamos los nuevos tokens (el backend los rota: da un refreshToken nuevo).
        this.accessToken = data.accessToken;
        this.setRefreshToken(data.refreshToken);
        return true;
      } catch {
        // Error de red u otro error inesperado: borramos sesión.
        this.clearTokens();
        return false;
      } finally {
        // `finally` se ejecuta SIEMPRE (tanto si hubo éxito como si hubo error).
        // Limpiamos la promesa para que la próxima renovación pueda iniciarse.
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // ── MÉTODO CENTRAL DE PETICIONES HTTP ────────────────────────────────────

  // Realiza una petición HTTP al backend del marketplace.
  // Si recibe 401 y hay refreshToken disponible, intenta renovar y reintenta.
  //
  // Parámetros:
  //   method → verbo HTTP ('GET', 'POST', 'PUT', 'DELETE')
  //   path   → ruta relativa, ej. '/auth/login' (se añade BASE_URL/api/marketplace)
  //   body   → cuerpo de la petición (opcional, para POST/PUT)
  //
  // Devuelve: Promise<T> con los datos parseados del JSON de respuesta.
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${BASE_URL}/api/marketplace${path}`; // URL completa

    // Cabeceras base. Si hay accessToken, añadimos la autorización Bearer.
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Primera petición. `let` (en lugar de `const`) porque podríamos reasignar
    // `res` si hacemos el reintento tras el refresh.
    let res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // ── Manejo de 401: token expirado ────────────────────────────────────────
    // Solo intentamos renovar si tenemos refreshToken (hay sesión que renovar).
    if (res.status === 401 && this.getRefreshToken()) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        // Actualizamos la cabecera con el nuevo accessToken y repetimos la petición.
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        res = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
      }
      // Si refreshed es false, res sigue siendo el 401 original y caerá
      // en el bloque !res.ok de abajo, lanzando el error.
    }

    // ── Manejo de cualquier error HTTP ────────────────────────────────────────
    if (!res.ok) {
      // .catch(() => ({ message: 'Error de red' })) → si el cuerpo no es JSON,
      // usamos un objeto de fallback con mensaje genérico.
      const err = await res.json().catch(() => ({ message: 'Error de red' }));
      // `throw new Error(...)` lanza una excepción que el llamador puede capturar
      // con try/catch. El mensaje usa || para elegir entre el del backend o uno genérico.
      throw new Error(err.message || `Error ${res.status}`);
    }

    return res.json(); // todo bien: devolvemos el cuerpo parseado
  }

  // ── MÉTODOS PÚBLICOS HTTP ABREVIADOS ─────────────────────────────────────

  // get: petición GET (solo lectura). No lleva body.
  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  // post: petición POST (crear / enviar datos).
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  // put: petición PUT (actualizar completamente un recurso).
  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  // del: petición DELETE. (Nombre corto porque "delete" es palabra reservada de JS.)
  del<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('DELETE', path, body);
  }

  // ── SUBIDA DE ARCHIVOS ────────────────────────────────────────────────────

  // Sube un archivo al servidor usando multipart/form-data.
  // A diferencia de request(), NO ponemos 'Content-Type': el navegador lo
  // establece automáticamente con el boundary correcto para multipart.
  //
  // Parámetros:
  //   path      → ruta del endpoint de subida
  //   file      → objeto File (el archivo seleccionado por el usuario)
  //   fieldName → nombre del campo en el formulario (default 'file')
  //
  // Incluye también el reintento automático tras 401.
  async uploadFile<T>(path: string, file: File, fieldName = 'file'): Promise<T> {
    const url = `${BASE_URL}/api/marketplace${path}`;

    // FormData es el objeto del navegador para enviar datos multipart.
    // .append(nombre, valor) añade un campo al formulario.
    const formData = new FormData();
    formData.append(fieldName, file); // añadimos el archivo bajo el nombre `fieldName`

    // Solo la cabecera de autorización; Content-Type lo maneja el navegador.
    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let res = await fetch(url, { method: 'POST', headers, body: formData });

    // Reintento idéntico al de request(): si 401 y hay refreshToken, renovamos y repetimos.
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

  // ── MÉTODOS DE AUTENTICACIÓN ──────────────────────────────────────────────

  // Inicia sesión con email o teléfono (identifier) y contraseña.
  // Guarda ambos tokens automáticamente.
  // Devuelve los datos del usuario más el campo `reactivated` (true si la cuenta
  // estaba suspendida y se reactivó al hacer login).
  //
  // `!!data.reactivated` → convierte cualquier valor a boolean:
  //   !! convierte undefined/null/false → false, cualquier otro valor → true.
  async loginAndStore(identifier: string, password: string) {
    const res: any = await this.post('/auth/login', { identifier, password });
    const data = res.data;
    this.accessToken = data.accessToken;
    this.setRefreshToken(data.refreshToken);
    // Operador de propagación (...data.user): copia todas las propiedades de
    // data.user en el nuevo objeto, y añadimos el campo `reactivated` encima.
    return { ...data.user, reactivated: !!data.reactivated };
  }

  // Registra un nuevo usuario en el marketplace.
  // Guarda ambos tokens y devuelve el perfil del usuario creado.
  //
  // Parámetros en un objeto (desestructurado):
  //   email, password, firstName, lastName → obligatorios
  //   phone                                → opcional (el ? lo indica)
  async registerAndStore(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    // Datos personales del formulario unificado (perfil completo desde el registro).
    birthDate?: string;
    gender?: string;
    // Token de "reclamo" (invitación de un negocio por WhatsApp): vincula la
    // ficha walk-in de ese negocio a la cuenta recién creada.
    claimToken?: string;
  }) {
    const res: any = await this.post('/auth/register', params);
    const data = res.data;
    this.accessToken = data.accessToken;
    this.setRefreshToken(data.refreshToken);
    return data.user;
  }

  // Inicia sesión mediante un proveedor social (Google o Facebook).
  // El `token` es el token de identidad que el proveedor social devuelve
  // al usuario tras autenticarse; el backend lo valida con las APIs de Google/Facebook.
  // `isNewUser` indica si es la primera vez que este usuario accede a la plataforma.
  async socialLoginAndStore(provider: 'google' | 'facebook', token: string) {
    const res: any = await this.post('/auth/social', { provider, token });
    const data = res.data;
    this.accessToken = data.accessToken;
    this.setRefreshToken(data.refreshToken);
    return { ...data.user, isNewUser: !!data.isNewUser };
  }

  // Cierra la sesión: notifica al backend para invalidar el refreshToken
  // (best-effort: ignoramos errores con .catch(() => {})) y borra los tokens locales.
  logout() {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      // Enviamos el refreshToken al backend para que lo invalide en base de datos.
      // .catch(() => {}) → si falla (sin internet, etc.), no hacemos nada.
      this.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    this.clearTokens(); // borramos los tokens del cliente independientemente
  }

  // Devuelve true si hay un refreshToken en localStorage (hay sesión activa).
  // !! convierte el string (o null) a boolean.
  isLoggedIn(): boolean {
    return !!this.getRefreshToken();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCIA SINGLETON: marketplaceApi
// ─────────────────────────────────────────────────────────────────────────────
// Creamos UNA SOLA instancia de la clase y la exportamos. Todos los archivos
// que importan `marketplaceApi` comparten el mismo objeto, por lo que el
// accessToken en memoria persiste entre navegaciones de la SPA (sin recargar).
export const marketplaceApi = new MarketplaceApiClient();
