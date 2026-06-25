// ============================================================
// ARCHIVO: apps/web/src/app/marketplace/layout.tsx
// ROL: Layout raíz del marketplace (portal cliente).
//
// ¿Qué es un layout.tsx en Next.js App Router?
//   En Next.js 14 con App Router, cada carpeta puede tener un
//   layout.tsx. Este archivo es el "marco" que envuelve a TODAS
//   las páginas dentro de la carpeta /marketplace. Se renderiza
//   UNA sola vez y sus hijos (children) son las páginas concretas.
//   Equivale a una plantilla HTML reutilizable: header fijo,
//   nav inferior, etc., sin re-montarse al navegar entre páginas.
//
// ¿Qué hace este layout?
//   1. Crea un QueryClient de React Query para gestionar caché de datos.
//   2. Envuelve la app en varios proveedores (Providers):
//      - QueryClientProvider: permite que cualquier hijo use useQuery/useMutation.
//      - ForceLightTheme: fuerza modo claro (no dark mode en marketplace V1).
//      - MarketplaceAuthProvider: pone el estado de autenticación disponible.
//      - MarketplaceAuthGuard: redirige al login si el usuario no está autenticado.
//   3. Usa un componente interno LayoutInner para detectar si estamos
//      en una página de auth (login/registro) y ajustar el layout:
//      - En páginas de auth: pantalla completa, sin bottom nav, sin padding.
//      - En otras páginas: min-h-screen con padding inferior (pb-20) para
//        que el contenido no quede tapado por el BottomNav de 80px.
//   4. Muestra el <CompleteProfileGate> (modal para completar perfil).
//   5. Muestra el <BottomNav> (barra de navegación inferior fija).
//   6. El modo ?fromAdmin=1 omite nav e gate porque el admin solo
//      viene a previsualizar, no a navegar como cliente.
// ============================================================

// 'use client' le dice a Next.js que este componente se ejecuta
// en el NAVEGADOR (cliente), no en el servidor. Es obligatorio
// cuando usamos hooks de React (useState, useEffect) o hooks de
// Next.js (usePathname, useSearchParams). Sin esta directiva,
// Next.js intentaría renderizarlo en el servidor y fallaría.
'use client';

// QueryClient: objeto central de React Query que guarda el caché
// de todas las peticiones HTTP del marketplace.
// QueryClientProvider: componente que "inyecta" el QueryClient
// a todos los componentes hijos mediante Context de React.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// MarketplaceAuthProvider: contexto personalizado que almacena el
// usuario autenticado, tokens JWT y funciones login/logout del marketplace.
import { MarketplaceAuthProvider } from '@/lib/hooks/use-marketplace-auth';

// useState: hook para declarar estado local en un componente funcional.
//   useState(valorInicial) devuelve [valorActual, funcionParaCambiarloValor].
// Suspense: componente de React que muestra un fallback mientras
//   sus hijos están "cargando" (esperando datos o código asíncrono).
import { useState, Suspense } from 'react';

// usePathname: hook de Next.js que devuelve la ruta URL actual
//   como string. Ej: "/marketplace/login".
// useSearchParams: hook de Next.js que devuelve los parámetros
//   de búsqueda de la URL. Ej: "?fromAdmin=1" → searchParams.get('fromAdmin') === '1'.
import { usePathname, useSearchParams } from 'next/navigation';

// CompleteProfileGate: componente que muestra un modal pidiendo
// al usuario que complete su perfil (teléfono, fecha de nacimiento,
// género) si esos datos faltan. Se define en el archivo adyacente.
import { CompleteProfileGate } from './complete-profile-gate';

// MarketplaceAuthGuard: componente "guardián" que comprueba si el
// usuario está autenticado. Si no lo está, redirige al login.
import { MarketplaceAuthGuard } from './auth-guard';

// BottomNav: barra de navegación inferior fija con 4 pestañas:
// Negocios, Citas, Cupones, Perfil. Típica de apps móviles.
import { BottomNav } from './bottom-nav';

// ForceLightTheme: componente que inyecta CSS para desactivar
// el modo oscuro del sistema operativo en el marketplace.
import { ForceLightTheme } from '@/components/ui/force-light-theme';

// ─── Constante de rutas públicas (sin autenticación) ───────────────────
// Array con las rutas de login y registro. Se usa para saber cuándo
// NO aplicar el layout completo (sin bottom nav, fondo h-screen).
const AUTH_PATHS = ['/marketplace/login', '/marketplace/register'];

// ─── Componente interno LayoutInner ────────────────────────────────────
// Este componente existe por separado porque usa useSearchParams(),
// que requiere estar dentro de <Suspense>. Next.js lo exige para
// no romper el pre-render estático en producción (build).
//
// PROPS (propiedades):
//   children: React.ReactNode
//     → Representa cualquier contenido JSX válido que se pase entre
//       las etiquetas del componente. Es el "hueco" donde van las páginas.
//       Ej: <LayoutInner><MiPagina /></LayoutInner>
function LayoutInner({ children }: { children: React.ReactNode }) {
  // usePathname devuelve la ruta actual. Ej: "/marketplace/login".
  const pathname = usePathname();

  // useSearchParams devuelve un objeto para leer ?param=valor de la URL.
  const searchParams = useSearchParams();

  // isAuthPage es true si la ruta actual empieza con alguna de las
  // AUTH_PATHS. Array.some() devuelve true en cuanto encuentra un match.
  // Ejemplo: pathname = "/marketplace/login" → isAuthPage = true.
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  // fromAdmin es true cuando la URL tiene ?fromAdmin=1.
  // Esto ocurre cuando un admin del negocio abre el marketplace
  // en modo previsualización desde su panel de control.
  // En ese modo eliminamos el nav inferior y el gate de perfil
  // incompleto porque el admin no necesita completar datos de cliente.
  const fromAdmin = searchParams.get('fromAdmin') === '1';

  // JSX: es la sintaxis parecida a HTML que usan los componentes React.
  // En JSX, las llaves {} permiten insertar expresiones JavaScript.
  return (
    // Fragmento de React (<>...</>): permite devolver múltiples elementos
    // sin añadir un div extra al DOM (Document Object Model).
    <>
      {/* Contenedor principal con clase condicional:
          - En páginas de auth: h-screen (100% alto de pantalla) + overflow-hidden
            para que el formulario de login no haga scroll.
          - En el resto: min-h-screen (mínimo 100% de altura) + bg-gray-50
            (fondo gris muy claro) + pb-20 (padding inferior de 80px para
            que el contenido no quede oculto bajo el BottomNav de 80px).
            Si fromAdmin=true, no añadimos pb-20 porque tampoco habrá BottomNav. */}
      <div className={isAuthPage ? 'h-screen overflow-hidden bg-gray-50' : `min-h-screen bg-gray-50 ${fromAdmin ? '' : 'pb-20'}`}>
        {/* children: aquí se renderiza la página actual (page.tsx) */}
        {children}

        {/* Renderizado condicional con &&:
            En JavaScript/JSX, "a && b" significa "si a es verdadero, muestra b".
            Aquí: si NO es página de auth Y NO es modo admin → mostramos CompleteProfileGate.
            El operador ! niega el valor: !isAuthPage = true cuando NO es página de auth. */}
        {!isAuthPage && !fromAdmin && <CompleteProfileGate />}
      </div>

      {/* BottomNav solo se muestra cuando NO estamos en modo admin.
          En modo admin (?fromAdmin=1) ocultamos la barra de navegación
          porque el administrador solo viene a previsualizar la app,
          no a navegar como cliente real. */}
      {!fromAdmin && <BottomNav />}
    </>
  );
}

// ─── Componente principal del Layout ───────────────────────────────────
// Este es el export default, es decir, el componente que Next.js
// usa automáticamente como layout para todas las rutas bajo /marketplace.
//
// PROPS:
//   children: React.ReactNode → las páginas concretas del marketplace.
export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  // useState con función inicializadora:
  //   useState(() => new QueryClient()) crea el QueryClient UNA SOLA VEZ
  //   cuando el componente se monta por primera vez. La función se llama
  //   solo en el primer render, no en cada re-render. Esto es importante
  //   para no crear un QueryClient nuevo en cada actualización (lo que
  //   borraría el caché de React Query en cada re-render).
  //
  // El array [queryClient] destructura el resultado: solo necesitamos
  // el valor, no el setter (por eso no ponemos [queryClient, setQueryClient]).
  const [queryClient] = useState(() => new QueryClient());

  return (
    // QueryClientProvider inyecta el queryClient a todos los hijos
    // mediante el Context de React. Cualquier componente dentro puede
    // usar useQuery() y useMutation() sin recibir el cliente como prop.
    <QueryClientProvider client={queryClient}>
      {/* ForceLightTheme: inyecta un <style> o clase para forzar
          el tema claro, independientemente de la preferencia del sistema. */}
      <ForceLightTheme />

      {/* MarketplaceAuthProvider: provee el estado de autenticación
          del marketplace (usuario, token, funciones login/logout/register).
          Todos los componentes hijos pueden leer este estado con
          useMarketplaceAuth(). */}
      <MarketplaceAuthProvider>
        {/* MarketplaceAuthGuard: es un "guardián". Verifica si el usuario
            está autenticado. Si no lo está (y no está en login/registro),
            redirige automáticamente a /marketplace/login. */}
        <MarketplaceAuthGuard>
          {/* Suspense necesario porque LayoutInner usa useSearchParams
              (fromAdmin) y eso obliga a opt-out de prerender estatico.
              Sin Suspense, /marketplace/login y /register fallan al build. */}
          {/* fallback={null}: mientras LayoutInner carga, no se muestra nada
              (null = sin contenido de espera). Se podría poner un spinner aquí. */}
          <Suspense fallback={null}>
            {/* LayoutInner recibe children (las páginas) como prop y
                decide cómo aplicar el padding, el nav, etc. */}
            <LayoutInner>{children}</LayoutInner>
          </Suspense>
        </MarketplaceAuthGuard>
      </MarketplaceAuthProvider>
    </QueryClientProvider>
  );
}
