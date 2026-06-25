// ============================================================
// ARCHIVO: use-auth.tsx
// PROPÓSITO: Maneja la autenticación de los usuarios del DASHBOARD
//            (dueños del negocio, administradores, etc.).
//
// ¿QUÉ ES UN HOOK PERSONALIZADO?
//   Un "hook" en React es una función especial cuyo nombre empieza con "use".
//   Permite encapsular lógica reutilizable de estado y efectos secundarios.
//   Un hook personalizado es uno que TÚ creas (no viene de React), como
//   "useAuth". Por dentro puede usar hooks propios de React (useState,
//   useEffect, etc.).
//
// ¿QUÉ ES UN CONTEXT / PROVIDER?
//   Context es una forma de compartir datos entre muchos componentes sin
//   tener que "pasar" esos datos manualmente por cada nivel del árbol.
//   El "Provider" es el componente que "envuelve" tu app y hace que esos
//   datos estén disponibles en cualquier componente hijo.
//   Metáfora: es como una "mochila invisible" que todos los componentes
//   pueden abrir y sacar lo que necesiten.
//
// ¿QUÉ ES localStorage?
//   Es un espacio de almacenamiento en el navegador que persiste entre
//   recargas de página. Se accede con localStorage.getItem/setItem/removeItem.
//   Aquí se guarda el "refreshToken" para que al recargar la página el
//   usuario siga logueado sin tener que volver a ingresar su contraseña.
// ============================================================

'use client';
// 'use client' le indica a Next.js 14 que este archivo se ejecuta en el
// navegador (lado cliente), NO en el servidor. Los hooks de React solo
// funcionan del lado cliente.

import {
  createContext,    // Crea un "contenedor" de datos compartidos (el Context)
  useContext,       // Hook para LEER los datos del Context desde cualquier componente
  useState,         // Hook para guardar y actualizar valores reactivos (estado)
  useEffect,        // Hook para ejecutar código con efectos secundarios (llamadas a API, etc.)
  useCallback,      // Hook para memorizar funciones y evitar que se recreen innecesariamente
  type ReactNode,   // Tipo de TypeScript: cualquier cosa que React pueda renderizar (JSX, texto, etc.)
} from 'react';
import { api } from '../api';                     // Cliente HTTP propio para llamar al backend
import {
  login as authLogin,       // Función que llama a POST /api/auth/login
  logout as authLogout,     // Función que llama a POST /api/auth/logout
  register as authRegister, // Función que llama a POST /api/auth/register
  getMe,                    // Función que llama a GET /api/auth/me (datos del usuario actual)
} from '../auth';
import type { AuthUser, RegisterParams, UnifiedLoginResult } from '../auth';
// AuthUser: forma del objeto usuario (id, email, name, permissions, etc.)
// RegisterParams: parámetros para registrar un nuevo usuario
// UnifiedLoginResult: lo que devuelve el login (puede incluir OTP, 2FA, etc.)

// ============================================================
// INTERFAZ: AuthContextType
// Define exactamente qué datos y funciones van a estar disponibles
// en el Context de autenticación. Es el "contrato" del Context.
// ============================================================
interface AuthContextType {
  user: AuthUser | null;            // El usuario logueado, o null si no hay sesión
  isLoading: boolean;               // true mientras se verifica si hay sesión activa (al cargar la app)
  isAuthenticated: boolean;         // true si hay un usuario logueado (atajo de "user !== null")
  login: (email: string, password: string) => Promise<UnifiedLoginResult>;  // Función para iniciar sesión
  register: (params: RegisterParams) => Promise<AuthUser>;                  // Función para registrarse
  logout: () => Promise<void>;      // Función para cerrar sesión
  refreshUser: () => Promise<void>; // Función para volver a cargar los datos del usuario desde el servidor
}

// ============================================================
// createContext<AuthContextType | undefined>(undefined)
//   Crea el "recipiente" que va a contener los datos de auth.
//   Empieza en "undefined" porque todavía no hay ningún Provider activo.
//   El tipo "<AuthContextType | undefined>" le dice a TypeScript que puede
//   ser un objeto AuthContextType o undefined (cuando no hay Provider).
// ============================================================
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================
// COMPONENTE: AuthProvider
// Es el "envoltorio" que debes poner en el nivel más alto de tu app.
// Hace que todos los componentes hijos puedan acceder a los datos de auth.
//
// Recibe: { children } — los componentes que envuelve (toda la app o una parte)
// ============================================================
export function AuthProvider({ children }: { children: ReactNode }) {

  // useState<AuthUser | null>(null)
  //   Crea una variable de estado "user" que empieza en null.
  //   "setUser" es la función para cambiarla. Cuando cambia, React
  //   vuelve a renderizar los componentes que usan este valor.
  const [user, setUser] = useState<AuthUser | null>(null);

  // isLoading empieza en true porque al cargar la app necesitamos
  // verificar si ya había una sesión activa (refreshToken en localStorage).
  // Se pone en false cuando terminamos esa verificación (con o sin éxito).
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================
  // useEffect(() => { ... }, [])
  //   Corre UNA SOLA VEZ cuando el componente se monta por primera vez
  //   (gracias al array vacío [] al final = sin dependencias).
  //   Se usa para verificar si el usuario ya tenía sesión activa.
  // ============================================================
  useEffect(() => {
    // typeof window !== 'undefined'
    //   En Next.js el código puede correr en el servidor (donde no existe
    //   "window" ni "localStorage"). Este chequeo asegura que solo
    //   accedemos a localStorage cuando estamos en el navegador.
    const refreshToken =
      typeof window !== 'undefined'
        ? localStorage.getItem('refreshToken')  // Intenta obtener el token guardado
        : null;                                  // En el servidor devuelve null

    if (refreshToken) {
      // Si había un refreshToken guardado, intentamos renovar la sesión
      // llamando al backend con ese token.
      api
        // POST /api/auth/refresh → devuelve accessToken y refreshToken nuevos
        .post<{ data: { accessToken: string; refreshToken: string } }>(
          '/api/auth/refresh',
          { refreshToken },
        )
        .then((res) => {
          // Con el nuevo accessToken, configuramos el cliente HTTP para que
          // lo incluya en todas las próximas peticiones (como header Authorization).
          api.setAccessToken(res.data.accessToken);
          // Guardamos el nuevo refreshToken (los tokens rotan por seguridad)
          localStorage.setItem('refreshToken', res.data.refreshToken);
          // Ahora pedimos los datos completos del usuario
          return getMe();
        })
        .then((res) => setUser(res.data))   // Guardamos el usuario en el estado
        .catch(() => {
          // Si el token expiró o fue inválido, eliminamos el token guardado
          // para que el usuario tenga que loguearse de nuevo.
          localStorage.removeItem('refreshToken');
        })
        .finally(() => setIsLoading(false)); // En cualquier caso, terminamos de cargar
    } else {
      // No había token guardado → no hay sesión activa → dejamos de cargar
      setIsLoading(false);
    }
  }, []); // Array vacío: este efecto corre solo una vez al montar el componente

  // ============================================================
  // useCallback(() => { ... }, [])
  //   Memoriza la función para que React no la recree en cada render.
  //   Importante cuando pasamos funciones como props o como dependencias
  //   de otros hooks, para evitar bucles infinitos o renders innecesarios.
  //   El array [] al final son las dependencias: si cambian, se recrea la función.
  // ============================================================

  // Función login: llama al servidor, guarda el usuario en el estado
  const login = useCallback(async (email: string, password: string): Promise<UnifiedLoginResult> => {
    // authLogin hace la llamada a POST /api/auth/login y guarda los tokens
    const result = await authLogin(email, password);

    // result.accessToken existe solo si el login fue exitoso (sin 2FA pendiente, etc.)
    if (result.accessToken) {
      // Pedimos los datos completos del usuario recién logueado
      const me = await getMe();
      setUser(me.data); // Guardamos el usuario en el estado del contexto
    } else {
      setUser(null); // Login no completado (ej. necesita verificación adicional)
    }
    return result; // Devolvemos el resultado para que el componente pueda reaccionar
  }, []); // Sin dependencias: la función nunca se recrea

  // Función register: registra un nuevo usuario y guarda su sesión
  const register = useCallback(async (params: RegisterParams): Promise<AuthUser> => {
    await authRegister(params); // Llama a POST /api/auth/register
    const me = await getMe();   // Luego obtiene los datos del nuevo usuario
    setUser(me.data);           // Guarda el usuario en el estado
    return me.data;             // Devuelve el usuario al componente que llamó
  }, []);

  // Función logout: cierra la sesión en el servidor y limpia el estado local
  const logout = useCallback(async () => {
    await authLogout(); // Llama al backend para invalidar el token
    setUser(null);      // Limpia el usuario del estado (el contexto queda sin usuario)
  }, []);

  // Función refreshUser: vuelve a cargar los datos del usuario desde el servidor.
  // Útil cuando el usuario actualiza su perfil y necesitamos reflejar los cambios.
  const refreshUser = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me.data);
    } catch {
      // Si falla (ej. sesión expirada), simplemente ignoramos el error
      // sin crashear la app. El usuario seguirá logueado con los datos anteriores.
      // ignore
    }
  }, []);

  // ============================================================
  // RENDERIZADO DEL PROVIDER
  // AuthContext.Provider "envuelve" a children y les pasa el valor
  // del contexto. Cualquier componente dentro de este árbol puede
  // usar useAuth() para acceder a estos datos.
  // ============================================================
  return (
    <AuthContext.Provider
      value={{
        user,                       // El usuario actual (o null)
        isLoading,                  // ¿Estamos verificando la sesión?
        isAuthenticated: !!user,    // !! convierte cualquier valor a booleano (true/false)
                                    // Si user es null → !!null = false
                                    // Si user es un objeto → !!{...} = true
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
      {/* children son todos los componentes hijos que envuelve este Provider */}
    </AuthContext.Provider>
  );
}

// ============================================================
// HOOK: useAuth
// Es la función que los componentes llaman para acceder al contexto.
// Solo puede usarse dentro de un componente que esté envuelto por AuthProvider.
//
// Devuelve: el objeto AuthContextType con user, isLoading, login, logout, etc.
// Lanza error si se usa fuera del Provider (para detectar errores de programación).
// ============================================================
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext); // Lee el valor actual del contexto
  // Si ctx es undefined, significa que useAuth se usó fuera del AuthProvider
  // → lanzamos un error claro para facilitar la depuración
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx; // Devuelve el contexto con todos los datos y funciones de auth
}
