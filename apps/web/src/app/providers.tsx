// ─────────────────────────────────────────────────────────────────────────────
// apps/web/src/app/providers.tsx
//
// CONCEPTO: Los "Providers" (proveedores) son componentes de React que
// usan el patrón de "Contexto" para hacer datos y funciones disponibles
// a TODOS sus componentes hijos, sin necesidad de pasar props manualmente
// a través de cada nivel del árbol de componentes.
//
// ANALOGÍA: Imagina que los Providers son como una "red de agua de la ciudad".
// En lugar de que cada casa lleve su propio tanque (pasando agua de componente
// a componente), hay una red central que abastece a todos. Los componentes
// "consumen" (useQuery, useAuth) sin preocuparse de cómo llegó el agua.
//
// Este archivo registra DOS proveedores globales:
//  1. QueryClientProvider → proveedor de React Query (para fetch de datos)
//  2. AuthProvider        → proveedor de autenticación (estado de sesión)
//
// Este archivo es un Client Component ('use client') porque necesita
// useState para crear el QueryClient, y los contextos de React solo
// funcionan en el lado del cliente.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

// ─── REACT QUERY ─────────────────────────────────────────────────────────────
// TanStack React Query es una librería para manejar fetching de datos (llamadas
// a la API) de forma inteligente: guarda en caché los resultados, los refresca
// automáticamente, maneja estados de carga/error, etc.
//
// QueryClient: el "cliente" central que almacena el caché de todas las queries.
// QueryClientProvider: el componente proveedor que hace que el QueryClient
//   esté disponible para todos los componentes hijos mediante el hook useQuery.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// useState: hook de React para guardar estado en un componente.
// ReactNode: tipo de TypeScript que representa cualquier cosa renderizable por React.
import { useState, type ReactNode } from 'react';

// AuthProvider: el proveedor del contexto de autenticación.
// Expone el estado de sesión (user, isAuthenticated, isLoading) y funciones
// (login, logout, register) a todos los componentes hijos.
import { AuthProvider } from '@/lib/hooks/use-auth';

// Setup global de dayjs (extiende plugin utc + locale es). Debe importarse
// desde un Client Component porque el bundle del cliente es distinto al del
// server; el import del layout root solo afecta al render server-side y
// dejaba dayjs.utc undefined en pages con 'use client'.
import '@/lib/dayjs-setup';

// ─── COMPONENTE PROVIDERS ────────────────────────────────────────────────────
// Recibe "children" → todo el contenido de la app que debe tener acceso
// a los contextos. Lo envolvemos con los dos proveedores.
export function Providers({ children }: { children: ReactNode }) {
  // useState con función inicializadora (lazy initialization):
  // La función se llama UNA SOLA VEZ cuando el componente se monta por primera vez.
  // Esto es importante: si usáramos "useState(new QueryClient(...))" sin la función,
  // se crearía un nuevo QueryClient en cada render, perdiendo el caché.
  // Con la función "() => new QueryClient(...)", solo se crea una vez.
  //
  // [queryClient] (sin setter): usamos destructuring de array, pero solo tomamos
  // el primer elemento (el valor actual del estado). No necesitamos la función
  // "setQueryClient" porque el QueryClient no debe cambiar durante la vida de la app.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // defaultOptions: configuración por defecto para TODAS las queries
        // (pueden sobreescribirse por query individual).
        defaultOptions: {
          queries: {
            // staleTime: tiempo en milisegundos que los datos se consideran "frescos".
            // Durante este tiempo, si el mismo query se ejecuta de nuevo, se devuelven
            // los datos cacheados SIN hacer una nueva petición a la API.
            // 1000 * 60 * 5 = 300000ms = 5 minutos
            staleTime: 1000 * 60 * 5, // 5 minutes

            // gcTime (Garbage Collection Time): tiempo que el caché se mantiene
            // en memoria DESPUÉS de que ningún componente lo está usando.
            // Pasado este tiempo, se elimina de memoria para liberar recursos.
            // 1000 * 60 * 15 = 900000ms = 15 minutos
            gcTime: 1000 * 60 * 15, // 15 minutes

            // retry: si una query falla, cuántas veces volver a intentarla
            // antes de marcarla como error definitivo. 1 = un reintento.
            retry: 1,

            // refetchOnWindowFocus: si se deben re-ejecutar las queries cuando
            // el usuario regresa a la pestaña del navegador. false = no refrescar
            // automáticamente (evita peticiones innecesarias a la API).
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // JSX: Anidamos los proveedores. El orden importa:
  // QueryClientProvider va afuera para que AuthProvider (y cualquier hook
  // que use useQuery internamente) también tenga acceso a React Query.
  //
  // ÁRBOL RESULTANTE:
  //   <QueryClientProvider>    ← React Query disponible para todos los hijos
  //     <AuthProvider>          ← Estado de auth disponible para todos los hijos
  //       {children}            ← El contenido real de la app (pages, layouts, etc.)
  //     </AuthProvider>
  //   </QueryClientProvider>
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
