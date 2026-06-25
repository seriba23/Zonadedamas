// ============================================================
// ARCHIVO: use-client-auth.tsx
// PROPÓSITO: Maneja la autenticación de los CLIENTES del portal
//            (los usuarios finales que reservan citas en un negocio).
//
//            DIFERENCIA CON use-auth.tsx:
//            - use-auth.tsx → para dueños/admin del negocio (dashboard)
//            - use-client-auth.tsx → para clientes finales (portal público)
//
//            IMPORTANTE: Cada negocio (tenant) tiene su propio portal con
//            su propio slug (ej. "mi-salon"). Los tokens de sesión se guardan
//            separados por tenantSlug, así el cliente puede tener sesión en
//            múltiples negocios simultáneamente sin conflictos.
//
// PATRÓN: Mismo patrón Context/Provider que use-auth.tsx pero adaptado
//         al portal de clientes y a portalApi en vez de api.
// ============================================================

'use client';
// 'use client': este archivo solo corre en el navegador, no en el servidor.

import {
  createContext,   // Crea el contenedor de datos compartidos
  useContext,      // Lee datos del contexto desde cualquier componente hijo
  useState,        // Guarda valores reactivos (user, isLoading)
  useEffect,       // Efectos secundarios: verificar sesión al montar
  useCallback,     // Memoriza funciones para evitar renders innecesarios
  type ReactNode,  // Tipo: cualquier cosa que React pueda renderizar
} from 'react';
import { portalApi } from '../portal-api';
// portalApi: cliente HTTP para las rutas del portal de clientes
// (prefijo /api/portal/:tenantSlug/...)

// ============================================================
// INTERFAZ: ClientUser
// Describe la forma del objeto "cliente" que devuelve el backend.
// El operador "| null" significa que el campo puede ser null (no tener valor).
// ============================================================
export interface ClientUser {
  id: string;               // ID único del cliente (UUID)
  firstName: string;        // Nombre
  lastName: string;         // Apellido
  email: string | null;     // Email (puede ser null si se registró con teléfono)
  phone: string | null;     // Teléfono (puede ser null si se registró con email)
  gender: string | null;    // Género ('MALE', 'FEMALE', 'NON_BINARY', etc.)
  dateOfBirth: string | null; // Fecha de nacimiento en formato ISO string
  avatarUrl: string | null; // URL de la foto de perfil (o null si no tiene)
  createdAt: string;        // Fecha de creación de la cuenta
}

// ============================================================
// INTERFAZ: ClientAuthContextType
// El "contrato" de qué datos y funciones estarán disponibles en el contexto.
// ============================================================
interface ClientAuthContextType {
  client: ClientUser | null;     // El cliente logueado, o null si no hay sesión
  isLoading: boolean;            // ¿Estamos verificando si hay sesión activa?
  isAuthenticated: boolean;      // true si client !== null
  tenantSlug: string;            // El slug del negocio actual (ej. "mi-salon")
  login: (identifier: string, password: string) => Promise<ClientUser>;
  // identifier: puede ser email O teléfono (el backend acepta ambos)
  register: (params: {
    identifier: string; // Email o teléfono para identificarse
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;     // ? significa que es opcional
    email?: string;     // ? significa que es opcional
  }) => Promise<ClientUser>;
  logout: () => Promise<void>;
}

// ============================================================
// Creamos el contexto, inicialmente undefined (sin Provider activo todavía)
// ============================================================
const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

// ============================================================
// COMPONENTE: ClientAuthProvider
// Envuelve el portal de un negocio específico para que sus páginas
// puedan acceder a la sesión del cliente.
//
// Recibe:
//   - children: los componentes hijos (páginas del portal)
//   - tenantSlug: el identificador del negocio (ej. "mi-salon")
// ============================================================
export function ClientAuthProvider({
  children,
  tenantSlug,
}: {
  children: ReactNode;
  tenantSlug: string;
}) {

  // Estado del cliente logueado (null = sin sesión)
  const [client, setClient] = useState<ClientUser | null>(null);

  // isLoading empieza en true: necesitamos verificar si ya había sesión
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================
  // CLAVE DE ALMACENAMIENTO ÚNICA POR NEGOCIO
  // Cada negocio guarda el refreshToken del cliente con una clave única
  // que incluye el tenantSlug. Así un cliente puede tener sesión en
  // "salon-a" y en "salon-b" al mismo tiempo sin que se mezclen.
  // Ejemplo de clave: "client_refresh_token_mi-salon"
  // ============================================================
  const storageKey = `client_refresh_token_${tenantSlug}`;

  // ============================================================
  // useEffect: corre cuando el componente se monta o cuando cambia
  // tenantSlug o storageKey (incluidos en el array de dependencias).
  // Se encarga de restaurar la sesión del cliente si ya había iniciado sesión.
  // ============================================================
  useEffect(() => {
    // Configuramos el portalApi para saber qué negocio es el destino
    // de todas las futuras peticiones HTTP desde este portal.
    portalApi.setTenantSlug(tenantSlug);

    // typeof window !== 'undefined': verificamos que estamos en el navegador
    // (Next.js puede pre-renderizar en el servidor donde no existe "window")
    const refreshToken =
      typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;

    if (refreshToken) {
      // Hay un token guardado → intentamos renovar la sesión
      portalApi
        // POST /auth/refresh → devuelve nuevos tokens
        .post<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
          refreshToken,
        })
        .then((res) => {
          // Configuramos el nuevo accessToken en el cliente HTTP
          portalApi.setAccessToken(res.accessToken);
          // Guardamos el nuevo refreshToken (los tokens rotan por seguridad)
          localStorage.setItem(storageKey, res.refreshToken);
          // Pedimos los datos actuales del cliente logueado
          return portalApi.get<ClientUser>('/auth/me');
        })
        .then((me) => setClient(me))  // Guardamos el cliente en el estado
        .catch(() => {
          // Si el refresh falla (token expirado o inválido), eliminamos el token
          // para que el usuario tenga que loguearse de nuevo
          localStorage.removeItem(storageKey);
        })
        .finally(() => setIsLoading(false)); // Terminamos de cargar en cualquier caso
    } else {
      // No había token → no hay sesión activa → terminamos de cargar
      setIsLoading(false);
    }
  }, [tenantSlug, storageKey]);
  // El array [tenantSlug, storageKey] significa: vuelve a correr este efecto
  // si cambia tenantSlug o storageKey. Importante si el usuario navega entre portales.

  // ============================================================
  // login: inicia sesión del cliente con email/teléfono y contraseña.
  //
  // Recibe: identifier (email o teléfono), password
  // Devuelve: Promise<ClientUser> (el cliente logueado)
  //
  // useCallback([storageKey]): la función se recrea solo si cambia storageKey.
  // ============================================================
  const login = useCallback(
    async (identifier: string, password: string): Promise<ClientUser> => {
      // POST /auth/login → devuelve accessToken, refreshToken y datos del cliente
      const res = await portalApi.post<{
        accessToken: string;
        refreshToken: string;
        client: ClientUser;
      }>('/auth/login', { identifier, password });

      // Guardamos el accessToken en el cliente HTTP para próximas peticiones
      portalApi.setAccessToken(res.accessToken);
      // Guardamos el refreshToken en localStorage para sesiones persistentes
      localStorage.setItem(storageKey, res.refreshToken);

      // Pedimos los datos completos del cliente (el login a veces no devuelve todo)
      const me = await portalApi.get<ClientUser>('/auth/me');
      setClient(me); // Actualizamos el estado del contexto
      return me;     // Devolvemos el cliente al componente que llamó login
    },
    [storageKey], // Dependencia: si cambia storageKey, la función se recrea
  );

  // ============================================================
  // register: registra un nuevo cliente y automáticamente inicia sesión.
  //
  // Recibe: params con identifier, password, nombre, apellido y opcionales
  // Devuelve: Promise<ClientUser> (el nuevo cliente ya logueado)
  // ============================================================
  const register = useCallback(
    async (params: {
      identifier: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;  // ? = opcional en TypeScript
      email?: string;  // ? = opcional en TypeScript
    }): Promise<ClientUser> => {
      // POST /auth/register → registra y devuelve tokens + cliente
      const res = await portalApi.post<{
        accessToken: string;
        refreshToken: string;
        client: ClientUser;
      }>('/auth/register', params);

      // Mismo flujo que login: guardamos tokens y cargamos datos completos
      portalApi.setAccessToken(res.accessToken);
      localStorage.setItem(storageKey, res.refreshToken);

      const me = await portalApi.get<ClientUser>('/auth/me');
      setClient(me);
      return me;
    },
    [storageKey],
  );

  // ============================================================
  // logout: cierra la sesión del cliente.
  //
  // 1. Llama al backend para invalidar el refreshToken (si existe)
  // 2. Limpia el accessToken del cliente HTTP
  // 3. Elimina el refreshToken del localStorage
  // 4. Pone client en null (el contexto queda sin usuario)
  // ============================================================
  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(storageKey);
    if (refreshToken) {
      // Intentamos invalidar el token en el servidor.
      // .catch(() => {}) → si falla (ej. servidor caído), continuamos de todas formas
      // El cliente quedará deslogueado localmente aunque falle en el servidor.
      await portalApi.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    portalApi.setAccessToken(null); // Limpiamos el token del cliente HTTP
    localStorage.removeItem(storageKey); // Eliminamos de localStorage
    setClient(null); // Limpiamos el estado del contexto
  }, [storageKey]);

  // ============================================================
  // RENDERIZADO DEL PROVIDER
  // Pasa todos los datos y funciones a los componentes hijos a través del contexto.
  // ============================================================
  return (
    <ClientAuthContext.Provider
      value={{
        client,                       // El cliente logueado (o null)
        isLoading,                    // ¿Verificando sesión?
        isAuthenticated: !!client,    // !! convierte null → false, objeto → true
        tenantSlug,                   // El slug del negocio actual
        login,
        register,
        logout,
      }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
}

// ============================================================
// HOOK: useClientAuth
// Los componentes del portal de clientes llaman este hook para acceder
// a la sesión del cliente (login, logout, datos del cliente, etc.).
//
// Devuelve: ClientAuthContextType con todos los datos y funciones
// Lanza error si se usa fuera del ClientAuthProvider
// ============================================================
export function useClientAuth(): ClientAuthContextType {
  const ctx = useContext(ClientAuthContext);
  // Si ctx es undefined, el hook se usó fuera del ClientAuthProvider → error claro
  if (!ctx) throw new Error('useClientAuth must be used within ClientAuthProvider');
  return ctx;
}
