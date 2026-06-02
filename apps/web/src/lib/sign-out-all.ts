import { api } from './api';
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
export async function signOutAll(): Promise<void> {
  if (typeof window === 'undefined') return;

  // ─── Admin / staff ──────────────────────────────────
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    api.setAccessToken(null);
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    if (refreshToken) {
      api.post('/api/auth/logout', { refreshToken }).catch(() => {});
    }
  } catch {}

  // ─── Cliente marketplace ────────────────────────────
  try {
    marketplaceApi.logout();
  } catch {}

  // ─── Cliente portal (un token por tenantSlug) ───────
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('client_refresh_token_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}

  // ─── Selector persistido ────────────────────────────
  try {
    sessionStorage.removeItem('login_role_choice');
  } catch {}
}
