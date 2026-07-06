// ─────────────────────────────────────────────────────────────────────────────
// FUNCIONES DE AUTENTICACIÓN (login, registro, logout, sesión)
//
// Este archivo NO dibuja nada en pantalla. Son funciones que las páginas de
// login/registro llaman para hablar con la API de auth y guardar/borrar los
// tokens (las "llaves" de la sesión) en el cliente.
// ─────────────────────────────────────────────────────────────────────────────

// "api" es el cliente HTTP del negocio (lib/api.ts). "marketplaceApi" es el del
// marketplace/cliente final. Importamos ambos porque un mismo usuario puede
// tener sesión de negocio Y de cliente a la vez (login unificado).
import { api } from './api';
import { marketplaceApi } from './marketplace-api';

// AuthUser: describe los datos del usuario logueado del lado del negocio.
// Los campos con "?" son opcionales (pueden faltar). "| null" significa que el
// valor puede ser nulo. "string[]" es un arreglo de textos.
export interface AuthUser {
  id: string;                 // id único del usuario
  tenantId: string;           // id del negocio (tenant) al que pertenece
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;  // foto de perfil (o null si no tiene)
  permissions: string[];      // lista de permisos ("appointments.create", ...)
  isAdmin?: boolean;          // ¿es administrador del negocio?
  isOwner?: boolean;          // ¿es el DUEÑO (rol owner)? Solo el dueño ve el portal admin completo y el cambio de perfil.
  employeeId?: string | null; // id como empleado (si también lo es)
  isEmployeeActive?: boolean; // ¿su ficha de empleado está activa?
  posEnabled?: boolean;       // ¿tiene acceso al Punto de Venta?
  jobTitle?: string | null;   // puesto/cargo
  tenantName?: string;        // nombre del negocio
  tenantCurrency?: string;    // moneda del negocio (MXN, USD...)
  // El tipo de negocio solo puede ser uno de estos textos (o null).
  tenantType?: 'FREELANCER' | 'BUSINESS' | null;
  subscriptionStatus?: string; // estado de la suscripción (ACTIVE, PAST_DUE...)
  subscriptionPlan?: string;   // plan contratado
  trialEndsAt?: string | null; // fecha de fin del período de prueba
}

// AuthTokens: el "paquete" que devuelve un login/registro: los dos tokens y el
// usuario. El accessToken caduca rápido (15 min); el refreshToken sirve para
// pedir un accessToken nuevo sin volver a escribir la contraseña.
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// UnifiedLoginResult: resultado del login "unificado". Un mismo correo puede ser
// a la vez admin/profesional (lado negocio) y cliente (lado marketplace). Por eso
// devuelve tokens separados para cada faceta y la lista de perfiles que tiene.
export interface UnifiedLoginResult {
  // legacy flat (business). null if user is client-only.
  // Campos "planos" heredados del lado negocio. Son null si el usuario es SOLO
  // cliente (no tiene acceso al dashboard del negocio).
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  // unified
  // "business": el paquete de sesión del negocio (o null si no aplica).
  business: { accessToken: string; refreshToken: string; user: AuthUser } | null;
  // "client": el paquete de sesión del cliente. "user: any" = tipo libre (no se
  // detalla aquí). null si el usuario no tiene perfil de cliente.
  client: { accessToken: string; refreshToken: string; user: any } | null;
  // profiles: qué facetas tiene este usuario. Array<...> es un arreglo cuyos
  // elementos solo pueden ser uno de esos tres textos.
  profiles: Array<'admin' | 'professional' | 'client'>;
}

// login(): inicia sesión con email + contraseña. async porque hace una llamada
// de red. Devuelve una Promise con el resultado unificado.
export async function login(
  email: string,
  password: string,
): Promise<UnifiedLoginResult> {
  // POST a /api/auth/login enviando las credenciales. El "<{ data: ... }>" le
  // dice a TypeScript la forma esperada de la respuesta (un objeto con "data").
  const res = await api.post<{ data: UnifiedLoginResult }>('/api/auth/login', {
    email,
    password,
  });
  // Sacamos el contenido real de dentro de "data".
  const data = res.data;

  // Persist business session (legacy flat fields)
  // Si vinieron tokens de negocio, guardamos la sesión del negocio: el access en
  // memoria (api) y el refresh en localStorage para sobrevivir recargas.
  if (data.accessToken && data.refreshToken) {
    api.setAccessToken(data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
  }

  // Persist client session if user has client profile
  // El "?." (optional chaining) lee la propiedad SOLO si "data.client" existe;
  // si fuera null, no intenta acceder y no falla. Si hay tokens de cliente,
  // guardamos también esa sesión en el cliente del marketplace.
  if (data.client?.accessToken && data.client?.refreshToken) {
    marketplaceApi.setSession(data.client.accessToken, data.client.refreshToken);
  }

  // Devolvemos todo el resultado a quien llamó (la página de login decide a
  // dónde redirigir según los "profiles").
  return data;
}

// RegisterParams: todos los datos que se pueden enviar al registrarse. Casi
// todos son opcionales ("?") porque el formulario varía según el tipo de
// registro (negocio, individuo, freelancer, empleado invitado...).
export interface RegisterParams {
  firstName: string; // obligatorios: nombre, apellido, email y contraseña
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  // Datos personales del formulario unificado (perfil de cliente completo desde
  // el registro, para no re-pedirlos al usar el lado cliente).
  birthDate?: string;
  gender?: string;
  inviteCode?: string; // código de invitación (para unirse como empleado)
  // Tipo de cuenta a crear (solo uno de esos tres valores).
  type?: 'business' | 'individual' | 'freelancer';
  businessName?: string;
  businessTypes?: string[]; // categorías del negocio (salón, spa...)
  businessType?: string; // legacy  (campo viejo, conservado por compatibilidad)
  businessStreet?: string;
  businessCity?: string;
  businessState?: string;
  businessPostalCode?: string;
  businessCountry?: string;
  businessAddress?: string; // legacy  (dirección en un solo campo, formato viejo)
  businessPhone?: string;
  // Direccion personal del usuario (User.address). Usada en register
  // afiliado para guardar la direccion personal del empleado, separada
  // de la del negocio Tenant.address.
  personalAddress?: string;
  selectedPlan?: string;    // plan elegido al registrarse
  acceptContract?: boolean; // ¿aceptó el contrato?
  acceptPrivacy?: boolean;  // ¿aceptó la política de privacidad?
}

// register(): crea una cuenta nueva. Recibe el objeto con los datos y, si todo
// va bien, deja la sesión iniciada (igual que login) y devuelve los tokens.
export async function register(params: RegisterParams): Promise<AuthTokens> {
  // Enviamos todos los parámetros al endpoint de registro.
  const res = await api.post<{ data: AuthTokens }>('/api/auth/register', params);
  // Guardamos el access token en memoria y el refresh en localStorage.
  api.setAccessToken(res.data.accessToken);
  localStorage.setItem('refreshToken', res.data.refreshToken);
  return res.data;
}

// logout(): cierra la sesión. "Promise<void>" = no devuelve ningún valor útil.
export async function logout(): Promise<void> {
  // Recuperamos el refresh token ANTES de borrarlo, para poder revocarlo abajo.
  const refreshToken = localStorage.getItem('refreshToken');
  // Clear local session immediately (no waiting)
  // Borramos la sesión local YA (sin esperar a la red), para que la UI reaccione
  // al instante. setAccessToken(null) olvida el token en memoria.
  api.setAccessToken(null);
  localStorage.removeItem('refreshToken');
  // Limpia tambien la sesion del marketplace si existe.
  localStorage.removeItem('marketplace_refresh_token');
  localStorage.removeItem('user');
  // Revoke token on backend in the background
  // Avisamos al backend para invalidar el refresh token (por seguridad), pero
  // SIN esperar la respuesta (no hay await). El ".catch(() => {})" ignora
  // cualquier error: aunque falle, la sesión local ya se borró.
  if (refreshToken) {
    api.post('/api/auth/logout', { refreshToken }).catch(() => {});
  }
}

// getMe(): pide al backend los datos del usuario logueado actual.
export async function getMe(): Promise<{ data: AuthUser }> {
  return api.get<{ data: AuthUser }>('/api/auth/me');
}

// hasRefreshToken(): dice si EXISTE un refresh token guardado (true/false).
export function hasRefreshToken(): boolean {
  // En el servidor no hay localStorage (window no existe) -> false.
  if (typeof window === 'undefined') return false;
  // "!!" convierte cualquier valor en booleano: !!texto -> true, !!null -> false.
  return !!localStorage.getItem('refreshToken');
}

// restoreSession(): comprueba si hay una sesión que restaurar al cargar la app.
// Devuelve true si existe un refresh token guardado.
export function restoreSession(): boolean {
  const refreshToken = localStorage.getItem('refreshToken');
  return !!refreshToken;
}
