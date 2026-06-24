// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE HTTP DEL DASHBOARD (negocio)
//
// Este archivo define UN cliente para hablar con la API (backend). Toda la app
// del negocio usa la instancia `api` (al final del archivo) para hacer
// peticiones GET/POST/etc. Centraliza tres cosas importantes:
//   1) Pegar la URL base a cada ruta.
//   2) Adjuntar el token de acceso (Authorization: Bearer ...) en cada llamada.
//   3) Si el token expiró (error 401), refrescarlo solo y reintentar.
// ─────────────────────────────────────────────────────────────────────────────

// ApiResponse<T>: describe la forma típica de una respuesta de la API. El "<T>"
// es un "genérico": un comodín de tipo. Quien use ApiResponse dice qué es "data"
// (ApiResponse<Cliente>, ApiResponse<Cita[]>...). "meta?" es opcional (el "?")
// y trae datos de paginación cuando la respuesta es una lista.
export interface ApiResponse<T> {
  data: T; // el contenido real de la respuesta (su tipo lo decide quien la use)
  meta?: {
    total: number;      // total de elementos disponibles
    page: number;       // página actual
    perPage: number;    // cuántos por página
    totalPages: number; // número total de páginas
  };
}

// ApiError: forma de un error devuelto por la API, para manejarlo en el front.
export interface ApiError {
  statusCode: number;  // código HTTP (404, 400, 500...)
  message: string;     // mensaje legible del error
  error?: string;      // etiqueta corta opcional del tipo de error
}

// "class" agrupa datos (propiedades) y funciones (métodos) que trabajan juntos.
// Aquí, ApiClient guarda la URL base y el token, y ofrece métodos get/post/etc.
class ApiClient {
  // "private" = solo accesible DENTRO de la clase (no desde fuera).
  private baseUrl: string;                 // dirección base de la API
  private accessToken: string | null = null; // token actual (o null si no hay sesión)
  // refreshPromise guarda el "trabajo en curso" de refrescar el token. Sirve
  // para que, si llegan varias peticiones a la vez con el token vencido, todas
  // esperen UN solo refresco en lugar de disparar muchos. Empieza en null.
  private refreshPromise: Promise<boolean> | null = null;

  // El "constructor" se ejecuta UNA vez al crear el objeto (new ApiClient()).
  constructor() {
    // Lee la URL de la API desde variables de entorno; si no, usa la local.
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  // setAccessToken(): guarda (o borra, con null) el token de acceso en memoria.
  // Lo llaman al iniciar sesión, al refrescar el token y al cerrar sesión.
  setAccessToken(token: string | null) {
    this.accessToken = token; // "this" se refiere a este objeto ApiClient
  }

  // request(): el método CENTRAL. Todos los get/post/put/etc. terminan aquí.
  // "async" indica que es asíncrono: hace cosas que tardan (red) y devuelve una
  // "Promise" (una promesa de un valor futuro). "await" pausa hasta que esa
  // promesa termine. Parámetros: method (GET/POST...), path (la ruta) y body
  // (datos a enviar; "unknown" = "de tipo desconocido", "?" = opcional).
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    // "headers" son metadatos que viajan con la petición. Record<string,string>
    // es un objeto cuyas claves y valores son textos. Indicamos que enviamos JSON.
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // Si hay token, lo añadimos como "Bearer" en la cabecera Authorization.
    // Así el backend sabe QUIÉN hace la petición.
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // fetch() es la función del navegador para hacer peticiones HTTP. Le pasamos
    // la URL completa (base + ruta) y opciones. await espera la respuesta.
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      // Si hay body, lo convertimos a texto JSON con JSON.stringify; si no,
      // enviamos undefined (sin cuerpo). GET normalmente no lleva body.
      body: body ? JSON.stringify(body) : undefined,
    });

    // 401 = "no autorizado": normalmente el token de acceso caducó. Solo
    // intentamos refrescar si además teníamos un token (había sesión).
    if (res.status === 401 && this.accessToken) {
      // tryRefresh() pide un token nuevo usando el refreshToken. Devuelve true
      // si lo logró.
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        // Con el token nuevo ya guardado, actualizamos la cabecera...
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        // ...y REINTENTAMOS la misma petición una vez.
        const retry = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        // .ok es true si el status está entre 200 y 299 (éxito). Si no, error.
        if (!retry.ok) throw await this.handleError(retry);
        // 204 = "sin contenido": no hay JSON que leer; devolvemos objeto vacío.
        // "as T" le dice a TypeScript "trata esto como el tipo T".
        if (retry.status === 204) return {} as T;
        // .json() lee el cuerpo y lo convierte de texto JSON a objeto JS.
        return retry.json();
      }
      // No se pudo refrescar -> la sesión murió de verdad. Si estamos en el
      // navegador (window existe), redirigimos al inicio para re-loguearse.
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
      // Lanzamos error para cortar el flujo de quien llamó.
      throw new Error('Sesión expirada');
    }

    // Camino normal (no fue 401): si la respuesta no es exitosa, lanzamos error.
    if (!res.ok) throw await this.handleError(res);
    // 204 sin contenido -> objeto vacío.
    if (res.status === 204) return {} as T;
    // Éxito con contenido: devolvemos el JSON parseado.
    return res.json();
  }

  // tryRefresh(): coordina el refresco para que solo ocurra UNA vez aunque lo
  // pidan varias peticiones a la vez. Devuelve una promesa de true/false.
  private async tryRefresh(): Promise<boolean> {
    // Singleton: avoid multiple parallel refresh calls
    // Si YA hay un refresco en curso (refreshPromise no es null), devolvemos esa
    // misma promesa para que todos esperen al mismo resultado.
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // No había refresco en curso: arrancamos uno y guardamos su promesa.
    this.refreshPromise = this.doRefresh();
    try {
      // Esperamos el resultado y lo devolvemos.
      return await this.refreshPromise;
    } finally {
      // "finally" SIEMPRE se ejecuta (haya éxito o error). Limpiamos la promesa
      // para permitir futuros refrescos.
      this.refreshPromise = null;
    }
  }

  // doRefresh(): el refresco real. Toma el refreshToken guardado y pide a la API
  // un nuevo par de tokens. Devuelve true si funcionó, false si no.
  private async doRefresh(): Promise<boolean> {
    // localStorage es el "almacén" del navegador (persiste entre recargas). Solo
    // existe en el navegador, por eso comprobamos window primero. Si estamos en
    // el server (typeof window === 'undefined'), no hay token: null.
    const refreshToken =
      typeof window !== 'undefined'
        ? localStorage.getItem('refreshToken')
        : null;
    // Sin refreshToken no se puede refrescar: false.
    if (!refreshToken) return false;
    try {
      // Pedimos tokens nuevos al endpoint de refresh.
      const res = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      // Si la API rechazó el refresh (token vencido/inválido), false.
      if (!res.ok) return false;
      const data = await res.json();
      // Guardamos el nuevo access token en memoria...
      this.accessToken = data.data.accessToken;
      // ...y el nuevo refresh token en localStorage (rotación: cada refresco
      // genera uno nuevo y el anterior deja de servir).
      localStorage.setItem('refreshToken', data.data.refreshToken);
      return true;
    } catch {
      // Si hubo cualquier fallo de red, lo tratamos como refresco fallido.
      return false;
    }
  }

  // handleError(): convierte una Response fallida en un objeto ApiError limpio.
  private async handleError(res: Response): Promise<ApiError> {
    // Intentamos leer el cuerpo como JSON. Si no es JSON válido, el .catch
    // devuelve un objeto vacío {} para no romper.
    const body = await res.json().catch(() => ({}));
    return {
      statusCode: res.status, // código HTTP del error
      // Usamos el mensaje del cuerpo; si no hay, el texto estándar del status.
      message: body.message || res.statusText,
      // "...body" (spread) copia el resto de campos del cuerpo al objeto final
      // (ej. "error", "details"), por si vienen del backend.
      ...body,
    };
  }

  // Los siguientes son "atajos" públicos. Cada uno llama a request() con el
  // método HTTP correspondiente, para que el resto de la app escriba
  // api.get('/ruta') en lugar de repetir toda la lógica de request.

  // GET: leer/consultar datos.
  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  // POST: crear datos nuevos (o acciones como login).
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  // PUT: reemplazar/actualizar un recurso completo.
  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  // PATCH: actualizar parcialmente (solo algunos campos).
  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  // DELETE: borrar un recurso.
  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  // uploadForm(): envía un formulario con campos de texto y, opcionalmente, un
  // archivo. Se usa cuando hay que subir datos + un archivo a la vez.
  async uploadForm<T>(
    path: string,
    fields: Record<string, string>, // pares clave/valor de texto
    file?: File,                    // archivo opcional
  ): Promise<T> {
    // FormData es un contenedor especial para enviar formularios con archivos.
    const formData = new FormData();
    // Object.entries(fields) convierte el objeto {a:'1', b:'2'} en un arreglo de
    // pares [['a','1'],['b','2']]. El for..of recorre cada par y, con
    // desestructuración [key, value], lo añade al formulario.
    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }
    // Si vino un archivo, lo agregamos bajo la clave 'file'.
    if (file) {
      formData.append('file', file);
    }

    // Para subidas NO ponemos Content-Type (ver nota en upload()); solo el token.
    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Enviamos el formulario por POST.
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    // Mismo manejo de token expirado que en request(): refrescar y reintentar.
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
        window.location.href = '/';
      }
      throw new Error('Sesión expirada');
    }

    if (!res.ok) throw await this.handleError(res);
    return res.json();
  }

  // upload(): versión simplificada para subir UN archivo (obligatorio) con
  // campos extra opcionales. Muy parecida a uploadForm pero con el archivo
  // primero.
  async upload<T>(
    path: string,
    file: File,
    extraFields?: Record<string, string>,
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file); // el archivo siempre va
    // Si hay campos extra, los recorremos y los agregamos uno a uno.
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
    // IMPORTANTE: al enviar FormData NO fijamos Content-Type a mano. El
    // navegador lo genera solo con un "boundary" (separador) interno que el
    // servidor necesita para distinguir cada parte del formulario.

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    // Mismo manejo de token expirado: refrescar y reintentar la subida una vez.
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
        window.location.href = '/';
      }
      throw new Error('Sesión expirada');
    }

    if (!res.ok) throw await this.handleError(res);
    return res.json();
  }
}

// Creamos UNA sola instancia compartida del cliente y la exportamos. Toda la app
// del negocio importa este mismo "api" (patrón singleton), así el token vive en
// un único lugar y todas las peticiones lo comparten.
export const api = new ApiClient();
