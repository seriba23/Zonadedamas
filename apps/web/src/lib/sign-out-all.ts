// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO: sign-out-all.ts
// ─────────────────────────────────────────────────────────────────────────────
// Función única que cierra TODAS las sesiones activas en el navegador de una vez.
//
// ¿Por qué es necesario un "cerrar sesión global"?
//   La app tiene múltiples portales con sus propios tokens:
//     1. Admin / staff del dashboard
//     2. Cliente del marketplace
//     3. Cliente del portal de cada negocio (uno por negocio)
//   El logout individual de cada hook solo limpia su propio portal,
//   dejando las demás sesiones vivas. Esto confunde la pantalla /login
//   que muestra un selector de rol basado en las sesiones activas.
//   Esta función los cierra todos de una sola vez.
// ─────────────────────────────────────────────────────────────────────────────

// `api` → cliente HTTP del dashboard admin/staff
import { api } from './api';
// `marketplaceApi` → cliente HTTP del marketplace de usuarios finales
import { marketplaceApi } from './marketplace-api';

/**
 * Cierra TODAS las sesiones del navegador: admin/staff, cliente marketplace,
 * cliente portal del negocio (todos los slugs), y elimina el `login_role_choice`
 * persistido en sessionStorage para que /login no restaure el selector.
 *
 * Es lo que el botón "Cerrar sesión" debe llamar desde cualquier portal —
 * el `logout()` de cada hook por separado solo cierra su propio espacio y
 * deja vivas las demás sesiones, lo que confunde al selector en /login.
 *
 * Revoca tokens en el backend de forma best-effort (sin esperar).
 */
// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: signOutAll
// ─────────────────────────────────────────────────────────────────────────────
// Cierra todas las sesiones activas en el navegador.
//
// Devuelve: Promise<void> (no hay valor de retorno útil).
//
// Cada sección está dentro de su propio try/catch vacío: si una falla
// (p.ej. el portal marketplace ya no tenía sesión), las demás siguen
// ejecutándose independientemente.
//
// Los tokens del backend se revocan con best-effort:
//   .catch(() => {}) → si la petición falla (sin red), no importa; los tokens
//   del cliente ya fueron borrados y caducarán solos.
export async function signOutAll(): Promise<void> {
  if (typeof window === 'undefined') return; // seguridad: no ejecutar en SSR

  // ─── Admin / staff ────────────────────────────────────────────────────────
  // Limpia la sesión del dashboard de negocio (propietario/empleados).
  // Tokens implicados:
  //   localStorage 'refreshToken' → token de refresh del admin/staff
  //   localStorage 'user'         → datos del usuario cacheados en local
  try {
    const refreshToken = localStorage.getItem('refreshToken'); // leemos antes de borrar
    api.setAccessToken(null);                // borramos accessToken de la memoria del cliente
    localStorage.removeItem('refreshToken'); // borramos refreshToken del localStorage
    localStorage.removeItem('user');         // borramos perfil cacheado
    if (refreshToken) {
      // Intentamos revocar el token en el backend (best-effort, no esperamos).
      api.post('/api/auth/logout', { refreshToken }).catch(() => {});
    }
  } catch {}

  // ─── Cliente marketplace ──────────────────────────────────────────────────
  // El objeto marketplaceApi ya tiene su propio método logout() que:
  //   - notifica al backend (best-effort)
  //   - borra el refreshToken de localStorage ('marketplace_refresh_token')
  //   - borra el accessToken de memoria
  try {
    marketplaceApi.logout();
  } catch {}

  // ─── Clientes del portal (un token por tenantSlug) ────────────────────────
  // El portal guarda un refreshToken por cada negocio bajo llaves con el formato:
  //   'client_refresh_token_<tenantSlug>'
  // Por eso debemos BUSCARLAS (no podemos hardcodear el slug).
  //
  // localStorage.length → número total de llaves guardadas
  // localStorage.key(i) → devuelve el nombre de la llave en la posición i
  //
  // IMPORTANTE: no borramos las llaves MIENTRAS iteramos el localStorage,
  // porque eso cambiaría los índices y saltaríamos entradas.
  // Solución: primero recopilamos los nombres en `keysToRemove`, luego borramos.
  try {
    const keysToRemove: string[] = []; // array donde acumulamos las llaves a borrar
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i); // llave en la posición i (puede ser null)
      // key && ... → si key es null (raro pero posible), no evaluamos el segundo operando.
      // .startsWith('client_refresh_token_') → identifica las llaves del portal.
      if (key && key.startsWith('client_refresh_token_')) {
        keysToRemove.push(key); // añadimos al listado para borrar después
      }
    }
    // .forEach() recorre cada elemento del array y ejecuta la función dada.
    // (k) => localStorage.removeItem(k) → borra cada llave encontrada.
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    // NOTA: los tokens del backend del portal NO se revocan aquí (no tenemos
    // los refreshTokens activos en este momento). Caducarán solos en 30 días.
  } catch {}

  // ─── Selector de rol persistido en sessionStorage ────────────────────────
  // En /login, el usuario elige entre roles (admin, cliente, etc.) y esa
  // elección se guarda en sessionStorage para no preguntarla de nuevo.
  // Al cerrar sesión global debemos borrarla para que aparezca limpia.
  try {
    sessionStorage.removeItem('login_role_choice');
  } catch {}
}
