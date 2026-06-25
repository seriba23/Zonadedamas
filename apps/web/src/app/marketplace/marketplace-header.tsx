// ============================================================
// ARCHIVO: apps/web/src/app/marketplace/marketplace-header.tsx
// ROL: Cabecera (header) del marketplace con logo y acceso al perfil.
//
// ¿Qué muestra?
//   - Izquierda: logo "Siliba" con eslogan (link a /marketplace).
//   - Derecha (según estado de auth):
//     → Si está cargando: no muestra nada (null) para evitar parpadeo.
//     → Si está autenticado: avatar del usuario (link a /marketplace/profile).
//     → Si NO está autenticado: botón "Iniciar sesion" (link a /marketplace/login).
//
// Nota: este header se usa en algunas páginas internas del marketplace
// que necesitan mostrar la cabecera con el logo. NO es el header sticky
// de la página principal (esa tiene su propio header inline en page.tsx).
// ============================================================

// 'use client': usa hooks (useMarketplaceAuth) → se ejecuta en el navegador.
'use client';

// Link: componente de Next.js para navegación client-side (sin recargar página).
import Link from 'next/link';

// useMarketplaceAuth: hook del contexto de auth que devuelve:
//   user: datos del usuario (firstName, lastName, avatarUrl, email...).
//   isAuthenticated: boolean → ¿tiene sesión activa?
//   isLoading: boolean → ¿está verificando el token JWT?
import { useMarketplaceAuth } from '@/lib/hooks/use-marketplace-auth';

// Avatar: componente reutilizable que muestra la foto del usuario (avatarUrl)
// o, si no hay foto, las iniciales coloreadas con fondo teal.
import { Avatar } from '@/components/ui/avatar';

// ─── Componente MarketplaceHeader ───────────────────────────────────
// No recibe props: lee todo del contexto de auth y del router.
export default function MarketplaceHeader() {
  // Extraemos del contexto de auth:
  //   user: objeto con los datos del usuario autenticado.
  //   isAuthenticated: boolean.
  //   isLoading: boolean.
  const { user, isAuthenticated, isLoading } = useMarketplaceAuth();

  return (
    // bg-white: fondo blanco.
    // border-b border-gray-200: línea separadora inferior gris claro.
    // px-4: padding horizontal de 16px.
    // pt-3 pb-3: padding superior e inferior de 12px.
    // safe-top: respeta el "notch" superior en iPhones (safe area CSS).
    <div className="bg-white border-b border-gray-200 px-4 pt-3 pb-3 safe-top">
      {/* max-w-2xl mx-auto: centra el contenido con ancho máximo ~672px.
          flex items-center justify-between: logo a la izquierda, acción a la derecha. */}
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        {/* Logo Siliba: link que lleva al inicio del marketplace.
            El nombre y el eslogan son el "logo" textual de la app. */}
        <Link href="/marketplace">
          {/* Nombre de la app en color teal, tipografía negrita. */}
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#008080' }}>Siliba</h1>
          {/* Eslogan de la app en texto gris pequeño. */}
          <p className="text-xs text-gray-500">Tu confianza, en manos de profesionales</p>
        </Link>

        {/* Renderizado condicional ternario encadenado:
            Es como un "if / else if / else" en una sola línea.
            Sintaxis: condición1 ? valorSiTrue1 : condición2 ? valorSiTrue2 : valorSiAmbas False

            - Si isLoading → null (no muestra nada mientras verifica auth).
            - Si isAuthenticated (y no loading) → muestra el avatar del usuario
              como link a su perfil.
            - Si !isAuthenticated (y no loading) → muestra botón "Iniciar sesion". */}
        {isLoading ? null : isAuthenticated ? (
          // Caso: usuario autenticado.
          // Link al perfil del usuario.
          <Link
            href="/marketplace/profile"
            className="flex items-center gap-2 text-sm text-gray-700"
          >
            {/* Avatar: componente que muestra la foto o las iniciales del usuario.
                PROPS:
                  avatarUrl: URL de la foto del usuario (puede ser null).
                  firstName: primer nombre (para generar iniciales si no hay foto).
                  lastName: apellido (para generar iniciales).
                  className: tamaño del avatar (w-8 h-8 = 32x32px). */}
            <Avatar
              avatarUrl={user?.avatarUrl}
              firstName={user?.firstName}
              lastName={user?.lastName}
              className="w-8 h-8"
            />
          </Link>
        ) : (
          // Caso: usuario NO autenticado.
          // Botón que lleva al login del marketplace.
          <Link
            href="/marketplace/login"
            className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: '#008080' }}
          >
            Iniciar sesion
          </Link>
        )}
      </div>
    </div>
  );
}
