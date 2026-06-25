// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/portal/[tenantSlug]/layout.tsx
//
// QUÉ ES ESTE ARCHIVO
// -------------------
// Layout (envoltorio) del portal de cliente para un tenant específico.
// En Next.js 14 App Router, "layout.tsx" es un archivo especial que envuelve
// a todas las páginas dentro de su misma carpeta y subcarpetas.
//
// ¿QUÉ ES [tenantSlug]?
// ----------------------
// Los corchetes en el nombre de carpeta indican un SEGMENTO DINÁMICO de la URL.
// Si la URL es /portal/salon-lucia/login, tenantSlug = "salon-lucia".
// Si la URL es /portal/barberia-jose/appointments, tenantSlug = "barberia-jose".
// Cada negocio (tenant) tiene su propio portal con su propio slug.
//
// QUÉ HACE ESTE LAYOUT
// --------------------
// Actúa como "proveedor raíz" para todo el portal:
// 1. Extrae el tenantSlug de la URL.
// 2. Crea un QueryClient de react-query (caché de peticiones HTTP).
// 3. Envuelve todo en QueryClientProvider (hace disponible react-query a hijos).
// 4. ForceLightTheme: fuerza el tema claro independientemente de la preferencia
//    del sistema operativo del usuario (evita que el modo oscuro rompa el diseño).
// 5. ClientAuthProvider: provee el contexto de autenticación del cliente a todas
//    las páginas hijas (login, appointments, book, etc.).
//
// JERARQUÍA EN NEXT.JS
// --------------------
// layout.tsx → page.tsx del mismo nivel o subdirectorios
// El layout solo se monta UNA VEZ y persiste mientras el usuario navega entre
// páginas hijas (appointments, book, profile, etc.), siendo eficiente.
// ─────────────────────────────────────────────────────────────────────────────

// 'use client': necesario porque usamos useParams() y useState(), ambos hooks
// que solo funcionan en el navegador.
'use client';

// useParams: hook de Next.js que devuelve los parámetros dinámicos de la URL.
// En /portal/[tenantSlug]/..., tenantSlug estará disponible aquí.
import { useParams } from 'next/navigation';

// QueryClient: objeto que gestiona la caché de peticiones HTTP.
// QueryClientProvider: componente de react-query que hace disponible el QueryClient
// a todos los componentes hijos mediante React Context (un canal de comunicación
// entre componentes sin necesidad de pasar props manualmente).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ClientAuthProvider: proveedor del contexto de autenticación del portal de cliente.
// Internamente gestiona el token JWT del cliente, sus datos de perfil, etc.
import { ClientAuthProvider } from '@/lib/hooks/use-client-auth';

// useState: necesario para crear el QueryClient una sola vez (ver abajo).
import { useState } from 'react';

// ForceLightTheme: componente que aplica estilos para forzar el tema claro.
import { ForceLightTheme } from '@/components/ui/force-light-theme';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE DE LAYOUT
//
// PROPS:
// - children: React.ReactNode — representa las páginas hijas que este layout
//   envuelve. Next.js los inyecta automáticamente. En JSX, children es el
//   contenido que se coloca entre las etiquetas de apertura y cierre del
//   componente: <Layout>aquí van los children</Layout>.
// ─────────────────────────────────────────────────────────────────────────────
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  // useParams() devuelve un objeto con los parámetros dinámicos de la URL.
  // Si la URL es /portal/salon-lucia/login:
  //   params.tenantSlug === 'salon-lucia'
  const params = useParams();

  // Convertimos a string explícitamente porque useParams() puede devolver
  // string | string[] | undefined, y nosotros sabemos que es siempre un string.
  // "as string" es un type assertion de TypeScript — le decimos al compilador
  // que confiamos en que será un string.
  const tenantSlug = params.tenantSlug as string;

  // Creamos el QueryClient DENTRO de useState para que:
  // 1. Solo se crea UNA VEZ (en el primer render), no en cada re-render.
  // 2. Cada instancia del layout tiene su propio caché aislado.
  // useState(() => new QueryClient()): la función de inicialización perezosa
  // (lazy initializer) — se ejecuta solo en el primer render, no en los siguientes.
  const [queryClient] = useState(() => new QueryClient());
  // Nota: no necesitamos setQueryClient porque nunca cambiamos el queryClient.

  return (
    // QueryClientProvider: todos los useQuery/useMutation de las páginas hijas
    // pueden usar este queryClient para hacer y cachear peticiones HTTP.
    <QueryClientProvider client={queryClient}>
      {/* ForceLightTheme: aplica CSS/variables de tema claro. No renderiza
          elementos visibles, solo efectos de estilo. */}
      <ForceLightTheme />

      {/* ClientAuthProvider: proporciona el contexto de autenticación a toda la
          jerarquía de páginas. tenantSlug le indica a qué tenant pertenece
          este portal (cada negocio tiene tokens separados). */}
      <ClientAuthProvider tenantSlug={tenantSlug}>
        {/* Contenedor base: mínimo 100vh de alto, fondo gris claro. */}
        <div className="min-h-screen bg-gray-50">
          {/* children: aquí se renderizan las páginas hijas (login, appointments,
              book, profile, etc.). Next.js inyecta el page.tsx correspondiente. */}
          {children}
        </div>
      </ClientAuthProvider>
    </QueryClientProvider>
  );
}
