// ============================================================
// ARCHIVO: use-platform-auth.tsx
// PROPÓSITO: Maneja la autenticación del SUPER ADMINISTRADOR de la plataforma.
//            El superadmin no es dueño de un negocio particular; es el
//            administrador de toda la plataforma Siliba (puede ver todos los
//            tenants, suspender negocios, gestionar suscripciones, etc.).
//
//            CUATRO tipos de usuarios en la plataforma:
//            1. Dashboard (use-auth.tsx)           → dueños/admin de negocios
//            2. Portal cliente (use-client-auth)   → clientes de UN negocio
//            3. Marketplace (use-marketplace-auth) → usuarios del marketplace
//            4. Platform (este archivo)             → SUPERADMIN de toda la plataforma
//
//            Este hook sigue exactamente el mismo patrón que use-auth.tsx
//            pero usa platformApi y rutas /api/platform/... en lugar de /api/...
// ============================================================

'use client';
// Solo corre en el navegador

import {
  createContext,   // Crea el contenedor de datos compartidos
  useContext,      // Lee los datos del contexto
  useState,        // Estado reactivo
  useEffect,       // Efecto para verificar sesión al montar
  useCallback,     // Memoriza funciones
  type ReactNode,  // Tipo: cualquier contenido React
} from 'react';
import {
  platformLogin,              // Función que llama a POST /api/platform/auth/login
  platformLogout,             // Función que llama a POST /api/platform/auth/logout
  platformGetMe,              // Función que llama a GET /api/platform/auth/me
  platformApi,                // Cliente HTTP configurado para rutas de platform
  hasPlatformRefreshToken,    // Función que verifica si hay token en localStorage
  type PlatformUser,          // Tipo del objeto superadmin
} from '../platform-auth';
// Todos importados desde el módulo de autenticación de plataforma

// ============================================================
// INTERFAZ: PlatformAuthContextType
// Contrato de qué datos y funciones estarán en el contexto del superadmin.
// Más simple que los otros contextos: no hay register() ni enterBusiness().
// ============================================================
interface PlatformAuthContextType {
  user: PlatformUser | null;   // El superadmin logueado, o null
  isLoading: boolean;          // ¿Verificando sesión inicial?
  isAuthenticated: boolean;    // Atajo: !!user
  login: (email: string, password: string) => Promise<PlatformUser>;
  logout: () => Promise<void>;
}

// ============================================================
// Creamos el contexto, inicialmente undefined (sin Provider activo)
// ============================================================
const PlatformAuthContext = createContext<PlatformAuthContextType | undefined>(undefined);

// ============================================================
// COMPONENTE: PlatformAuthProvider
// Envuelve las páginas del panel de superadmin para compartir la sesión.
//
// Recibe: { children } — los componentes hijos (páginas del superadmin)
// ============================================================
export function PlatformAuthProvider({ children }: { children: ReactNode }) {

  // Estado del superadmin logueado
  const [user, setUser] = useState<PlatformUser | null>(null);

  // isLoading: true mientras verificamos si hay sesión activa
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================
  // useEffect: corre UNA VEZ al montar el componente.
  // Intenta restaurar la sesión del superadmin usando el refreshToken
  // guardado en localStorage bajo la clave 'platformRefreshToken'.
  // ============================================================
  useEffect(() => {
    // hasPlatformRefreshToken(): verifica si existe 'platformRefreshToken' en localStorage.
    // Si no hay token, no hay sesión → salimos inmediatamente.
    if (!hasPlatformRefreshToken()) {
      setIsLoading(false);
      return; // "return" sale del efecto inmediatamente
    }

    // Leemos el token guardado
    const refreshToken = localStorage.getItem('platformRefreshToken');
    if (refreshToken) {
      // Intentamos renovar la sesión llamando al endpoint de refresh
      platformApi
        // POST /api/platform/auth/refresh → devuelve nuevos tokens
        .post<{ data: { accessToken: string; refreshToken: string } }>(
          '/api/platform/auth/refresh',
          { refreshToken },
        )
        .then((res) => {
          // Guardamos el nuevo accessToken en el cliente HTTP
          platformApi.setAccessToken(res.data.accessToken);
          // Guardamos el nuevo refreshToken (los tokens rotan por seguridad)
          localStorage.setItem('platformRefreshToken', res.data.refreshToken);
          // Pedimos los datos del superadmin
          return platformGetMe();
        })
        .then((res) => setUser(res.data))  // Guardamos el superadmin en el estado
        .catch(() => {
          // Si el token expiró o es inválido, eliminamos el token guardado
          localStorage.removeItem('platformRefreshToken');
          // El usuario tendrá que loguearse de nuevo
        })
        .finally(() => setIsLoading(false)); // En cualquier caso, terminamos de cargar
    } else {
      // No había token (aunque hasPlatformRefreshToken devolvió true, extraño caso borde)
      setIsLoading(false);
    }
  }, []); // [] = corre solo una vez al montar

  // ============================================================
  // login: inicia sesión del superadmin.
  //
  // Recibe: email, password
  // Devuelve: Promise<PlatformUser> (el superadmin logueado)
  //
  // La función platformLogin (importada) hace la llamada HTTP y guarda
  // los tokens en localStorage. Aquí solo actualizamos el estado.
  // ============================================================
  const login = useCallback(async (email: string, password: string): Promise<PlatformUser> => {
    // platformLogin: POST /api/platform/auth/login, guarda tokens, devuelve { user }
    const data = await platformLogin(email, password);
    setUser(data.user); // Actualizamos el estado del contexto con el superadmin
    return data.user;   // Devolvemos el usuario al componente que llamó login
  }, []); // [] = sin dependencias, la función nunca se recrea

  // ============================================================
  // logout: cierra la sesión del superadmin.
  //
  // platformLogout: llama al backend para invalidar el token y limpia localStorage.
  // Luego ponemos user en null para que el contexto refleje que no hay sesión.
  // ============================================================
  const logout = useCallback(async () => {
    await platformLogout(); // Invalida el token en el servidor + limpia localStorage
    setUser(null);          // Limpia el estado del contexto
  }, []);

  // ============================================================
  // RENDERIZADO DEL PROVIDER
  // Pasa los datos y funciones a todos los componentes hijos del superadmin.
  // ============================================================
  return (
    <PlatformAuthContext.Provider
      value={{
        user,                       // El superadmin (o null)
        isLoading,                  // ¿Verificando sesión?
        isAuthenticated: !!user,    // !!null = false, !!objeto = true
        login,
        logout,
      }}
    >
      {children}
    </PlatformAuthContext.Provider>
  );
}

// ============================================================
// HOOK: usePlatformAuth
// Los componentes del panel de superadmin llaman este hook para
// acceder a la sesión (login, logout, datos del superadmin, etc.).
//
// Devuelve: PlatformAuthContextType con todos los datos y funciones
// Lanza error si se usa fuera del PlatformAuthProvider
// ============================================================
export function usePlatformAuth(): PlatformAuthContextType {
  const ctx = useContext(PlatformAuthContext);
  // Si ctx es undefined, el hook se usó fuera del PlatformAuthProvider
  if (!ctx) throw new Error('usePlatformAuth must be used within PlatformAuthProvider');
  return ctx;
}
