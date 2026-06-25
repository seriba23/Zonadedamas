// ============================================================
// ARCHIVO: apps/web/src/app/marketplace/auth-guard.tsx
// ROL: Guardián de autenticación del marketplace.
//
// ¿Qué es un "Auth Guard" (guardián de autenticación)?
//   Es un componente que actúa como "portero": antes de renderizar
//   sus hijos (children), verifica si el usuario tiene sesión activa.
//   Si no la tiene (y no está en una ruta pública), lo redirige al
//   login automáticamente. Es un patrón muy común en SPAs (Single
//   Page Applications) para proteger rutas privadas.
//
// Flujo de decisión:
//   1. ¿Estamos en una ruta pública (login/registro)?
//      → SÍ: renderizar los hijos directamente sin revisar auth.
//   2. ¿Está cargando el estado de autenticación?
//      → SÍ: mostrar spinner de "Cargando..." (evita parpadeo).
//   3. ¿El usuario NO está autenticado?
//      → Redirigir a /marketplace/login?redirect=<rutaActual>
//      (el parámetro ?redirect guarda la ruta para volver después de login).
//   4. ¿El usuario SÍ está autenticado?
//      → Renderizar los hijos normalmente.
// ============================================================

// 'use client': este componente se ejecuta en el navegador porque
// usa hooks (useEffect, useRouter, usePathname) que no funcionan
// en el servidor de Next.js.
'use client';

// useEffect: hook que ejecuta código DESPUÉS de que el componente
// se renderiza en pantalla. Es el lugar correcto para hacer
// redirecciones (ya que no se puede redirigir durante el render).
import { useEffect } from 'react';

// usePathname: devuelve la ruta URL actual. Ej: "/marketplace/profile".
// useRouter: permite navegar programáticamente entre páginas.
//   router.replace(url) → navega a url SIN guardar la ruta actual
//   en el historial del navegador (el botón "Atrás" no vuelve al guard).
import { usePathname, useRouter } from 'next/navigation';

// useMarketplaceAuth: hook personalizado que devuelve el estado
// de autenticación del marketplace:
//   - isAuthenticated: boolean → true si hay sesión activa.
//   - isLoading: boolean → true mientras se verifica el token JWT.
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';

// ─── Lista de rutas públicas ─────────────────────────────────────────
// Estas rutas son accesibles SIN estar autenticado. Cualquier otra
// ruta bajo /marketplace requerirá sesión activa.
const PUBLIC_PATHS = [
  '/marketplace/login',
  '/marketplace/register',
  '/marketplace/forgot-password',
];

// ─── Componente MarketplaceAuthGuard ────────────────────────────────
// PROPS (propiedades que recibe del componente padre):
//   children: React.ReactNode
//     → Los componentes hijos que se renderizarán si la auth es válida.
//       Es la "página protegida" que solo verá el usuario autenticado.
export function MarketplaceAuthGuard({ children }: { children: React.ReactNode }) {
  // Extraemos del contexto de auth los valores que necesitamos:
  //   isAuthenticated: ¿tiene el usuario una sesión válida?
  //   isLoading: ¿está aún verificando el token? (petición inicial a la API)
  const { isAuthenticated, isLoading, activeProfile, profilesLoaded } = useMarketplaceAuth();

  // pathname: la ruta actual del navegador. Ej: "/marketplace/profile".
  const pathname = usePathname();

  // router: objeto para hacer navegación programática.
  const router = useRouter();

  // isPublicPath: booleano que indica si estamos en una ruta pública.
  // Array.some() recorre PUBLIC_PATHS y devuelve true si pathname
  // EMPIEZA con alguna de ellas (pathname.startsWith(p)).
  // Ej: pathname="/marketplace/login" → isPublicPath = true.
  // Ej: pathname="/marketplace/profile" → isPublicPath = false.
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // ¿Estamos ya en la pantalla de selección/gestión de perfiles? Ahí NO se debe
  // aplicar el "gate de perfil" (sería un bucle: te manda al selector estando ya
  // en el selector).
  const isProfilesPath = pathname.startsWith('/marketplace/profiles');

  // useEffect se ejecuta DESPUÉS del render, cuando el DOM ya está listo.
  // El array de dependencias [isLoading, isAuthenticated, isPublicPath, pathname, router]
  // hace que el efecto se re-ejecute cada vez que cambie alguno de esos valores.
  useEffect(() => {
    // Solo redirigimos cuando:
    //   1. isLoading es false: ya terminamos de verificar el token.
    //   2. isAuthenticated es false: el usuario NO tiene sesión.
    //   3. isPublicPath es false: no estamos en login/registro (no hace falta auth allí).
    if (!isLoading && !isAuthenticated && !isPublicPath) {
      // encodeURIComponent(pathname): codifica la ruta para que sea segura
      // como parámetro de URL. Ej: "/marketplace/profile" → "%2Fmarketplace%2Fprofile".
      // Así cuando el usuario inicia sesión, podemos llevarlo de vuelta
      // a la página que intentaba ver.
      router.replace(`/marketplace/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, isPublicPath, pathname, router]);

  // GATE DE PERFIL: si el usuario está autenticado pero todavía no eligió un
  // perfil (estilo Netflix), lo enviamos al selector. Esperamos a profilesLoaded
  // para no redirigir antes de saber si había un perfil activo guardado.
  useEffect(() => {
    if (
      !isLoading &&
      isAuthenticated &&
      profilesLoaded &&
      !activeProfile &&
      !isPublicPath &&
      !isProfilesPath
    ) {
      router.replace('/marketplace/profiles');
    }
  }, [isLoading, isAuthenticated, profilesLoaded, activeProfile, isPublicPath, isProfilesPath, router]);

  // ─── Decisiones de renderizado (renderizado condicional) ────────────

  // CASO 1: ruta pública (login, registro).
  // Los <> y </> son un "Fragment" de React: devuelve children sin añadir
  // un div extra al DOM. children es la página de login/registro.
  if (isPublicPath) return <>{children}</>;

  // CASO 2: aún cargando el estado de auth.
  // Mostramos un spinner para evitar el "parpadeo" que ocurriría si
  // mostráramos el contenido y luego lo quitáramos al descubrir que
  // el usuario no está autenticado.
  if (isLoading) {
    return (
      // min-h-screen: la pantalla ocupa al menos el 100% de la altura.
      // flex items-center justify-center: centra el contenido horizontal y verticalmente.
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          {/* Spinner de carga:
              - w-8 h-8: 32x32 píxeles.
              - border-2: borde de 2px.
              - border-gray-300: borde gris claro en 3 lados.
              - border-t-[#008080]: borde superior teal (hace el efecto giratorio).
              - rounded-full: forma circular.
              - animate-spin: animación de rotación continua (Tailwind). */}
          <div className="w-8 h-8 border-2 border-gray-300 border-t-[#008080] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  // CASO 3: el usuario NO está autenticado (y no es ruta pública).
  // Devolvemos null (nada) mientras el useEffect de arriba hace la
  // redirección. Evitamos mostrar contenido privado por un instante.
  if (!isAuthenticated) return null;

  // CASO 4: autenticado pero aún no eligió perfil (y no está en el selector):
  // no renderizamos la página; el efecto de arriba redirige al selector.
  if (profilesLoaded && !activeProfile && !isProfilesPath) return null;

  // CASO 5: el usuario SÍ está autenticado y ya tiene perfil activo (o está en
  // el selector). Renderizamos los hijos (la página protegida) normalmente.
  return <>{children}</>;
}
