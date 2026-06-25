// ─────────────────────────────────────────────────────────────────────────────
// DIRECTIVA: 'use client'
// ─────────────────────────────────────────────────────────────────────────────
// Le dice a Next.js 14 que este módulo solo se ejecuta en el NAVEGADOR
// (nunca en el servidor). Es obligatorio porque usamos localStorage y
// window.location, que no existen en el servidor.
'use client';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTE: CREATOR_TOKEN_KEY
// ─────────────────────────────────────────────────────────────────────────────
// Nombre de la llave (key) que usamos para guardar el token de acceso del
// creador/influencer en localStorage. Centralizarlo aquí evita errores de
// tipeo si lo escribimos en varios lugares.
const CREATOR_TOKEN_KEY = 'creatorAccessToken';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFAZ: CreatorProfile
// ─────────────────────────────────────────────────────────────────────────────
// Define la "forma" del objeto que describe a un creador/influencer logueado.
// TypeScript usa esto para validar que el backend devuelve todos los campos
// esperados y para autocompletar en el editor.
//
// Campos:
//   id                      → identificador único (UUID/CUID)
//   email                   → correo electrónico
//   firstName               → nombre
//   lastName                → apellido
//   phone                   → teléfono; puede ser null si no lo proporcionó
//   status                  → estado de la cuenta: pendiente, aprobado o suspendido
//                             (union de strings literales; solo esos tres valores son válidos)
//   stripeOnboardingComplete → true si ya completó el registro en Stripe para cobrar
export interface CreatorProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED';
  stripeOnboardingComplete: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTE: BASE
// ─────────────────────────────────────────────────────────────────────────────
// URL base del backend (API).
// process.env.NEXT_PUBLIC_API_URL → variable de entorno definida en .env.local
//   Con el prefijo NEXT_PUBLIC_ Next.js la expone al navegador.
// || 'http://localhost:3001'      → operador "OR": si la variable no está
//   definida (undefined o vacía), usa el valor por defecto del servidor local.
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: getCreatorToken
// ─────────────────────────────────────────────────────────────────────────────
// Lee y devuelve el token de acceso guardado en localStorage.
//
// ¿Por qué comprobamos typeof window === 'undefined'?
//   En Next.js el código puede ejecutarse en el servidor (SSR/SSG) donde
//   no existe `window` ni `localStorage`. Si lo llamamos ahí lanzaría un
//   error. La comprobación devuelve null de forma segura en ese caso.
//
// Devuelve: string con el token si existe, null si no hay token o estamos
//           en el servidor.
export function getCreatorToken(): string | null {
  if (typeof window === 'undefined') return null;   // seguridad en SSR (servidor)
  return localStorage.getItem(CREATOR_TOKEN_KEY);   // lee la llave del almacén local
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: setCreatorToken
// ─────────────────────────────────────────────────────────────────────────────
// Guarda o elimina el token de acceso en localStorage.
//
// Parámetros:
//   token → el nuevo token (string) para guardar, o null para borrarlo
//
// Lógica:
//   - Si `token` tiene valor → lo guarda con setItem.
//   - Si `token` es null     → lo elimina con removeItem.
//     (el operador `else` cubre también undefined/vacío porque la firma dice null)
//
// No devuelve nada (void).
export function setCreatorToken(token: string | null) {
  if (typeof window === 'undefined') return;                     // seguridad en SSR
  if (token) localStorage.setItem(CREATOR_TOKEN_KEY, token);    // guarda si hay valor
  else localStorage.removeItem(CREATOR_TOKEN_KEY);              // borra si es null
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN INTERNA: request<T>
// ─────────────────────────────────────────────────────────────────────────────
// Función central que realiza todas las peticiones HTTP al backend.
// Es genérica: <T> es un "placeholder" de tipo que el llamador rellena para
// indicar qué tipo de datos espera recibir (ej. request<CreatorProfile>).
//
// Es `async` porque hace operaciones que tardan (red). Devuelve Promise<T>:
// una promesa que, cuando se resuelve, contiene un valor de tipo T.
//
// Parámetros:
//   method → verbo HTTP: 'GET', 'POST', 'PUT', 'DELETE', etc.
//   path   → ruta relativa del endpoint, ej. '/api/creator/auth/login'
//   body   → cuerpo de la petición (para POST/PUT). El tipo `unknown` es el
//             tipo más genérico de TypeScript: acepta cualquier valor.
//             El `?` lo hace opcional (puede omitirse).
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // Obtenemos el token guardado (puede ser null si no hay sesión).
  const token = getCreatorToken();

  // Cabeceras HTTP que mandamos en cada petición.
  // "Record<string, string>" es un objeto donde tanto las llaves como los
  // valores son cadenas de texto (un diccionario de string→string).
  // 'Content-Type': 'application/json' le dice al servidor que el cuerpo
  // está en formato JSON.
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Si tenemos token, añadimos la cabecera de autorización.
  // El formato "Bearer <token>" es el estándar para JWT.
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // fetch() realiza la petición HTTP. `await` pausa la función hasta que
  // la petición termina (sin bloquear el hilo del navegador).
  // `${BASE}${path}` concatena la URL base con la ruta específica.
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    // body: si hay cuerpo lo convertimos a texto JSON; si no, undefined
    // (fetch ignora body: undefined en GET/DELETE).
    // El operador ternario  condición ? valorSiTrue : valorSiFalse
    body: body ? JSON.stringify(body) : undefined,
  });

  // ── Manejo de error 401 (No autorizado) ──────────────────────────────────
  // Si el servidor responde 401, el token expiró o es inválido.
  if (res.status === 401) {
    setCreatorToken(null);  // borramos el token roto del localStorage
    // Redirigimos al login, pero SOLO si:
    //   1. Estamos en el navegador (typeof window !== 'undefined')
    //   2. La ruta no es de autenticación (no contiene '/auth/')
    //      para evitar un bucle infinito si /auth/login mismo devuelve 401.
    if (typeof window !== 'undefined' && !path.includes('/auth/')) {
      window.location.href = '/creator/login';  // redirección dura al login
    }
  }

  // ── Manejo de cualquier error HTTP ───────────────────────────────────────
  // res.ok es true si el status está entre 200-299.
  if (!res.ok) {
    // Intentamos parsear el cuerpo del error como JSON para obtener el mensaje.
    // .catch(() => ({})) evita que un error de parseo rompa todo: si el cuerpo
    // no es JSON válido, simplemente usamos un objeto vacío {}.
    const err = await res.json().catch(() => ({}));
    // `throw` lanza una excepción que cortará la ejecución aquí.
    // Los operadores de propagación (...err) copian todas las propiedades del
    // objeto err en el objeto lanzado, enriqueciendo el error con detalles.
    throw { statusCode: res.status, message: err.message || res.statusText, ...err };
  }

  // Si todo fue bien, parseamos y devolvemos el JSON de la respuesta.
  // TypeScript confía en que el JSON tiene la forma T (no valida en runtime).
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// OBJETO: creatorApi
// ─────────────────────────────────────────────────────────────────────────────
// Expone métodos abreviados (get y post) que internamente llaman a `request`.
// Es un objeto literal con dos propiedades que son funciones flecha.
//
// Por qué tener este objeto en lugar de llamar request() directamente:
// → Centraliza la interfaz; si mañana queremos añadir logging o caché, lo
//   hacemos en un solo lugar.
//
// <T> en las funciones flecha: el llamador especifica qué tipo espera,
// por ejemplo: creatorApi.get<{ data: CreatorProfile }>('/api/creator/me')
export const creatorApi = {
  // get: solo necesita la ruta; el método HTTP es siempre 'GET'.
  get: <T>(path: string) => request<T>('GET', path),
  // post: también recibe un body opcional (datos que enviar al servidor).
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: creatorLogin
// ─────────────────────────────────────────────────────────────────────────────
// Inicia sesión de un creador/influencer con email y contraseña.
//
// Parámetros:
//   email    → correo electrónico del creador
//   password → contraseña en texto plano (el servidor la compara con el hash)
//
// Devuelve: objeto con `accessToken` (string JWT) y `influencer` (CreatorProfile)
//
// Flujo:
//   1. Llama al endpoint POST /api/creator/auth/login enviando email+password.
//   2. El tipo esperado de la respuesta es { data: { accessToken, influencer } }.
//   3. Guarda el token en localStorage (para usarlo en peticiones futuras).
//   4. Devuelve res.data para que el componente que llamó a esta función
//      pueda acceder al perfil del influencer.
export async function creatorLogin(email: string, password: string) {
  const res = await creatorApi.post<{ data: { accessToken: string; influencer: CreatorProfile } }>(
    '/api/creator/auth/login',
    { email, password },
  );
  // Guardamos el token recibido para que las próximas peticiones lo incluyan.
  setCreatorToken(res.data.accessToken);
  return res.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: creatorRegister
// ─────────────────────────────────────────────────────────────────────────────
// Registra un nuevo creador/influencer en la plataforma.
//
// Parámetros (en un objeto `body`):
//   email     → correo
//   firstName → nombre
//   lastName  → apellido
//   phone     → teléfono (opcional, el `?` lo indica)
//   password  → contraseña a crear
//
// Devuelve: los datos devueltos por el servidor (any porque el backend puede
//           variar; no se necesita tipado estricto aquí).
//
// NOTA: el registro NO guarda el token; el creador debe iniciar sesión
//       por separado (el backend puede requerir aprobación primero).
export async function creatorRegister(body: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;   // `?` significa que este campo es opcional
  password: string;
}) {
  const res = await creatorApi.post<{ data: any }>('/api/creator/auth/register', body);
  return res.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: creatorSetPassword
// ─────────────────────────────────────────────────────────────────────────────
// Establece una contraseña usando un token de invitación (magic link).
// Se usa cuando el creador recibió un correo de invitación y debe crear su
// contraseña por primera vez.
//
// Parámetros:
//   token    → token de invitación de un solo uso (viene en la URL del correo)
//   password → contraseña nueva que el usuario eligió
//
// Devuelve: objeto con `accessToken` (puede ser null si aún no está aprobado)
//           y `influencer` (perfil del creador).
//
// Si el backend devuelve un accessToken, lo guardamos de inmediato para que
// el creador quede logueado automáticamente.
export async function creatorSetPassword(token: string, password: string) {
  const res = await creatorApi.post<{ data: { accessToken: string | null; influencer: CreatorProfile } }>(
    '/api/creator/auth/set-password',
    { token, password },
  );
  // Operador `if`: solo guardamos el token si no es null.
  // (Si la cuenta está PENDING, el backend no devuelve token todavía.)
  if (res.data.accessToken) setCreatorToken(res.data.accessToken);
  return res.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: creatorChangePassword
// ─────────────────────────────────────────────────────────────────────────────
// Cambia la contraseña de un creador ya autenticado.
//
// Parámetros:
//   currentPassword → contraseña actual (para verificar identidad)
//   newPassword     → contraseña nueva
//
// Devuelve: objeto { changed: boolean } — true si el cambio fue exitoso.
//
// Requiere que el creador ya esté logueado (la función `request` incluye
// automáticamente el token Bearer en la cabecera Authorization).
export async function creatorChangePassword(currentPassword: string, newPassword: string) {
  const res = await creatorApi.post<{ data: { changed: boolean } }>(
    '/api/creator/change-password',
    { currentPassword, newPassword },
  );
  return res.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: creatorLogout
// ─────────────────────────────────────────────────────────────────────────────
// Cierra la sesión del creador borrando el token local y redirigiendo al login.
//
// NOTA: a diferencia de otros portales, aquí NO se notifica al backend para
// invalidar el token en el servidor. Simplemente se borra del localStorage.
// (El token expirará solo al cabo de su tiempo de vida.)
//
// No devuelve nada (void). La redirección cambia la página del navegador.
export function creatorLogout() {
  setCreatorToken(null);                                                       // borra el token local
  if (typeof window !== 'undefined') window.location.href = '/creator/login'; // redirige al login
}
