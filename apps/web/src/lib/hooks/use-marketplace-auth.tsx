// ============================================================
// ARCHIVO: use-marketplace-auth.tsx
// PROPÓSITO: Maneja la autenticación de los usuarios del MARKETPLACE
//            (compradores que buscan y reservan servicios en múltiples negocios).
//
//            TRES tipos de usuarios en la plataforma:
//            1. Dashboard (use-auth.tsx)         → dueños/admin de negocios
//            2. Portal cliente (use-client-auth) → clientes de UN negocio específico
//            3. Marketplace (este archivo)        → usuarios que navegan TODOS los negocios
//
//            El usuario de marketplace puede "entrar" a un negocio específico
//            (función enterBusiness), lo que le otorga tokens de cliente portal
//            para ese negocio, permitiendo reservar citas sin registrarse dos veces.
//
// EXTRAS DE ESTE HOOK vs LOS OTROS:
//   - Login social (Google, Facebook)
//   - genderSuffix(): función auxiliar para mensajes con género correcto
//   - enterBusiness(): "puente" entre marketplace y portal de cliente
// ============================================================

'use client';
// Este archivo solo corre en el navegador

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
// createContext: crea el contenedor de datos compartidos
// useContext: lee los datos del contexto
// useState: variables de estado reactivas
// useEffect: efectos secundarios (verificar sesión al montar)
// useCallback: memoriza funciones para evitar recreaciones innecesarias
// ReactNode: tipo TypeScript para cualquier contenido renderable por React
import { marketplaceApi } from '../marketplace-api';
// marketplaceApi: cliente HTTP para rutas del marketplace (/api/marketplace/...)
import { portalApi } from '../portal-api';
// portalApi: cliente HTTP para rutas del portal de cliente (/api/portal/:tenantSlug/...)
// Se usa en enterBusiness para configurar la sesión del portal

// ============================================================
// INTERFAZ: MarketplaceUser
// Describe el objeto del usuario de marketplace.
// Los campos con ? son OPCIONALES en TypeScript (pueden no estar presentes).
// Los campos con | null pueden estar presentes pero tener valor nulo.
// ============================================================
interface MarketplaceUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;          // Puede existir o ser null
  avatarUrl?: string | null;     // ? = opcional; | null = puede ser null
  gender?: string | null;        // 'MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_SAY'
  birthDate?: string | null;     // Fecha de nacimiento en formato ISO
  allergies?: string | null;     // Notas médicas/alergias del usuario
  address?: string | null;       // Dirección
  socialProvider?: string | null; // 'google', 'facebook', o null si no usa login social
  hasPassword?: boolean;         // false si solo se registró con redes sociales
}

// ============================================================
// FUNCIÓN AUXILIAR EXPORTADA: genderSuffix
// Devuelve el sufijo de género correcto para mensajes en español.
//
// Recibe: gender (string opcional o null)
// Devuelve: "o" (masculino), "a" (femenino), "@" (neutral/desconocido)
//
// USO: "Bienvenid" + genderSuffix(user.gender)
//   → "Bienvenido" (MALE)
//   → "Bienvenida" (FEMALE)
//   → "Bienvenid@" (NON_BINARY o null)
// ============================================================

/** Returns gendered suffix: "o" (male), "a" (female), "@" (neutral/unknown) */
export function genderSuffix(gender?: string | null): string {
  if (gender === 'MALE') return 'o';
  if (gender === 'FEMALE') return 'a';
  return '@'; // Para NON_BINARY, PREFER_NOT_SAY, o cuando no se conoce el género
}

// ============================================================
// INTERFAZ: MarketplaceAuthContextType
// Contrato de qué datos y funciones estarán disponibles en el contexto.
// ============================================================
interface MarketplaceAuthContextType {
  user: MarketplaceUser | null;    // Usuario logueado, o null
  isAuthenticated: boolean;        // Atajo: !!user
  isLoading: boolean;              // ¿Verificando sesión inicial?
  login: (email: string, password: string) => Promise<MarketplaceUser & { reactivated?: boolean }>;
  // login devuelve el usuario + un flag opcional "reactivated" (cuenta reactivada tras suspensión)
  register: (params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => Promise<MarketplaceUser>;
  socialLogin: (provider: 'google' | 'facebook', token: string) => Promise<MarketplaceUser & { isNewUser?: boolean }>;
  // socialLogin: login con token de OAuth de Google o Facebook
  // devuelve usuario + flag "isNewUser" para saber si es el primer login
  logout: () => void;              // Cierra sesión (sincrónico, sin esperar respuesta del servidor)
  refreshUser: () => Promise<void>; // Recarga los datos del usuario desde el servidor
  enterBusiness: (tenantSlug: string) => Promise<{
    clientAccessToken: string;
    clientRefreshToken: string;
    tenant: { id: string; slug: string; name: string };
  }>;
  // enterBusiness: crea sesión de cliente para un negocio específico,
  // sin que el usuario tenga que registrarse de nuevo en ese negocio
}

// ============================================================
// Creamos el contexto con valor inicial null (sin Provider activo todavía)
// ============================================================
const MarketplaceAuthContext = createContext<MarketplaceAuthContextType | null>(null);

// ============================================================
// COMPONENTE: MarketplaceAuthProvider
// Envuelve las páginas del marketplace para compartir la sesión del usuario.
//
// Recibe: { children } — los componentes hijos (páginas del marketplace)
// ============================================================
export function MarketplaceAuthProvider({ children }: { children: ReactNode }) {

  // Estado del usuario del marketplace (null = sin sesión)
  const [user, setUser] = useState<MarketplaceUser | null>(null);

  // isLoading: true mientras verificamos si ya había sesión activa
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================
  // useEffect: corre una sola vez al montar el componente.
  // Verifica si marketplaceApi ya tiene tokens almacenados y,
  // si los tiene, carga los datos del usuario.
  // ============================================================
  useEffect(() => {
    // marketplaceApi.isLoggedIn(): verifica internamente si hay tokens
    // guardados (en localStorage o memoria). Devuelve true/false.
    if (marketplaceApi.isLoggedIn()) {
      // Hay tokens → cargamos los datos del usuario
      marketplaceApi
        .get<{ data: MarketplaceUser }>('/auth/me')
        .then((res) => setUser(res.data))  // Guardamos el usuario en el estado
        .catch(() => setUser(null))         // Si falla (token expirado), sin sesión
        .finally(() => setIsLoading(false)); // En cualquier caso, terminamos de cargar
    } else {
      // Sin tokens → no hay sesión activa
      setIsLoading(false);
    }
  }, []); // [] = solo corre una vez al montar

  // ============================================================
  // fetchFullUser: función interna para cargar los datos COMPLETOS del usuario.
  //
  // El motivo: las respuestas de login/register solo devuelven datos básicos.
  // Llamando a /auth/me obtenemos campos adicionales como birthDate, allergies,
  // gender, address, etc. que son necesarios en el perfil.
  //
  // Se llama en segundo plano DESPUÉS del login/register (fire-and-forget):
  //   await login(...)   → el estado ya tiene los datos básicos (UI responde rápido)
  //   fetchFullUser()    → luego actualiza con datos completos en el fondo
  // ============================================================

  // Fetch full user data after login (login responses don't include all fields)
  const fetchFullUser = useCallback(async () => {
    try {
      const res = await marketplaceApi.get<{ data: MarketplaceUser }>('/auth/me');
      setUser(res.data); // Actualiza el estado con los datos completos
    } catch {
      // keep partial data
      // Si falla, dejamos los datos parciales que ya tenemos. No es crítico.
    }
  }, []); // Sin dependencias: la función nunca se recrea

  // ============================================================
  // login: inicia sesión con email y contraseña.
  //
  // Recibe: identifier (email), password
  // Devuelve: usuario con flag opcional { reactivated?: boolean }
  //   reactivated = true si la cuenta estaba suspendida y se reactivó automáticamente
  //
  // useCallback([fetchFullUser]): se recrea solo si cambia fetchFullUser
  // (que nunca cambia por su [] vacío, así que en práctica también es estable)
  // ============================================================
  const login = useCallback(async (identifier: string, password: string) => {
    // marketplaceApi.loginAndStore: hace POST /auth/login y guarda los tokens
    const result = await marketplaceApi.loginAndStore(identifier, password);
    // Desestructuramos: separamos "reactivated" del resto de datos del usuario.
    // El spread {...userData} contiene los campos de MarketplaceUser.
    // "reactivated" va aparte porque no es parte del tipo MarketplaceUser.
    const { reactivated, ...userData } = result;
    setUser(userData);   // Guardamos los datos básicos del usuario (respuesta rápida)
    fetchFullUser();     // Luego cargamos datos completos en segundo plano
    return result;       // Devolvemos el resultado completo (con reactivated) al componente
  }, [fetchFullUser]);

  // ============================================================
  // register: registra un nuevo usuario de marketplace.
  //
  // Recibe: params con email, password, firstName, lastName, phone opcional
  // Devuelve: Promise<MarketplaceUser>
  // ============================================================
  const register = useCallback(
    async (params: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string; // ? = opcional
    }) => {
      // marketplaceApi.registerAndStore: POST /auth/register + guarda tokens
      const u = await marketplaceApi.registerAndStore(params);
      setUser(u);       // Guardamos datos básicos
      fetchFullUser();  // Cargamos datos completos en segundo plano
      return u;
    },
    [fetchFullUser],
  );

  // ============================================================
  // socialLogin: inicia sesión con Google o Facebook.
  //
  // Recibe:
  //   provider: 'google' | 'facebook' (cuál red social)
  //   token: el token OAuth que devolvió la red social
  //
  // Devuelve: usuario con flag opcional { isNewUser?: boolean }
  //   isNewUser = true si es la primera vez que este usuario usa la plataforma
  // ============================================================
  const socialLogin = useCallback(
    async (provider: 'google' | 'facebook', token: string) => {
      // marketplaceApi.socialLoginAndStore: POST /auth/social + guarda tokens
      const result = await marketplaceApi.socialLoginAndStore(provider, token);
      // Separamos isNewUser del resto de datos del usuario
      const { isNewUser, ...userData } = result;
      setUser(userData);  // Guardamos datos básicos
      fetchFullUser();    // Cargamos datos completos en segundo plano
      return result;      // Devolvemos con isNewUser para que el componente pueda
                          // mostrar un mensaje de bienvenida diferente si es usuario nuevo
    },
    [fetchFullUser],
  );

  // ============================================================
  // logout: cierra la sesión del marketplace.
  // Es SINCRÓNICO (no async) porque marketplaceApi.logout() limpia tokens
  // localmente sin necesitar confirmación del servidor.
  // ============================================================
  const logout = useCallback(() => {
    marketplaceApi.logout(); // Limpia tokens de localStorage/memoria
    setUser(null);           // Limpia el estado del contexto
  }, []);

  // ============================================================
  // refreshUser: recarga los datos del usuario desde el servidor.
  // Útil cuando el usuario actualiza su perfil y queremos reflejar los cambios.
  // ============================================================
  const refreshUser = useCallback(async () => {
    try {
      const res = await marketplaceApi.get<{ data: MarketplaceUser }>('/auth/me');
      setUser(res.data);
    } catch {
      // silently fail
      // Si falla (sesión expirada, etc.), simplemente no actualizamos.
      // El usuario seguirá viendo los datos anteriores hasta que cierre sesión.
    }
  }, []);

  // ============================================================
  // enterBusiness: permite al usuario del marketplace "entrar" a un negocio
  // específico y obtener tokens de cliente para ese negocio.
  //
  // Recibe: tenantSlug (ej: "mi-salon")
  // Devuelve: clientAccessToken, clientRefreshToken, tenant info
  //
  // Función clave del flujo marketplace → portal:
  //   1. Usuario hace clic en "Reservar" en un negocio
  //   2. Se llama enterBusiness("mi-salon")
  //   3. El backend genera tokens de cliente para ese negocio
  //   4. Guardamos esos tokens en localStorage y en portalApi
  //   5. El usuario puede ahora usar el portal del negocio sin volver a loguearse
  // ============================================================
  const enterBusiness = useCallback(
    async (tenantSlug: string) => {
      // POST /api/marketplace/enter/:tenantSlug
      // El backend usa el token del marketplace para generar tokens de cliente
      const res: any = await marketplaceApi.post(`/enter/${tenantSlug}`);
      const data = res.data;

      // Store client tokens so portal auth works seamlessly
      // typeof window !== 'undefined': verificamos que estamos en el navegador
      if (typeof window !== 'undefined') {
        // Guardamos el refreshToken del portal con la clave única por negocio.
        // Esto es lo mismo que hace ClientAuthProvider al loguearse normalmente.
        // De esta forma, el portal de cliente puede iniciar sesión sin pasos extra.
        localStorage.setItem(
          `client_refresh_token_${tenantSlug}`, // Clave única: "client_refresh_token_mi-salon"
          data.clientRefreshToken,               // El token de cliente generado por el backend
        );
      }
      // Configuramos portalApi para el negocio que acaba de "entrar"
      portalApi.setTenantSlug(tenantSlug);
      // Guardamos el accessToken del portal en memoria (para uso inmediato)
      portalApi.setAccessToken(data.clientAccessToken);

      return data; // Devolvemos todos los datos al componente que llamó
    },
    [], // Sin dependencias: la función nunca se recrea
  );

  // ============================================================
  // RENDERIZADO DEL PROVIDER
  // Comparte todos los datos y funciones con los componentes hijos
  // a través del contexto de marketplace.
  // ============================================================
  return (
    <MarketplaceAuthContext.Provider
      value={{
        user,                       // El usuario del marketplace (o null)
        isAuthenticated: !!user,    // !!null = false, !!{...} = true
        isLoading,                  // ¿Verificando sesión?
        login,
        register,
        socialLogin,
        logout,
        refreshUser,
        enterBusiness,
      }}
    >
      {children}
    </MarketplaceAuthContext.Provider>
  );
}

// ============================================================
// HOOK: useMarketplaceAuth
// Los componentes del marketplace llaman este hook para acceder
// a la sesión del usuario (login, logout, datos del usuario, etc.).
//
// Devuelve: MarketplaceAuthContextType con todos los datos y funciones
// Lanza error si se usa fuera del MarketplaceAuthProvider
// ============================================================
export function useMarketplaceAuth() {
  const ctx = useContext(MarketplaceAuthContext);
  if (!ctx) {
    // Error claro para facilitar la depuración durante el desarrollo
    throw new Error('useMarketplaceAuth must be used within MarketplaceAuthProvider');
  }
  return ctx;
}
