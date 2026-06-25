// ─────────────────────────────────────────────────────────────────────────────
// apps/web/src/app/(auth)/layout.tsx
//
// CONCEPTO: Layout del "grupo de rutas" de autenticación.
//
// GRUPOS DE RUTAS en Next.js App Router:
// Las carpetas con nombre entre paréntesis "(nombre)" son "grupos de rutas".
// La particularidad es que el nombre en paréntesis NO forma parte de la URL:
//
//   app/(auth)/login/page.tsx     → URL: /login   (no /auth/login)
//   app/(auth)/register/page.tsx  → URL: /register
//   app/(auth)/forgot-password/page.tsx → URL: /forgot-password
//
// ¿Para qué sirve el grupo entonces?
//  → Para compartir un mismo layout entre varias rutas SIN que el nombre
//    del grupo aparezca en la URL. Es organización pura de carpetas.
//
// Aquí, el grupo (auth) agrupa todas las páginas públicas de autenticación
// y les aplica este layout que garantiza que SIEMPRE se muestren en modo claro
// (sin importar si el usuario eligió tema oscuro en otra parte de la app).
// ─────────────────────────────────────────────────────────────────────────────

// Client Component porque ForceLightTheme necesita manipular el DOM del navegador
// (acceder a document.documentElement para leer/cambiar el data-theme).
'use client';

// ForceLightTheme: un componente pequeño (probablemente un hook + efecto)
// que al montarse fuerza data-theme='' en el <html> para anular el modo oscuro.
// Cuando el usuario sale de estas páginas (va al dashboard), el tema se restaura.
import { ForceLightTheme } from '@/components/ui/force-light-theme';

/**
 * Layout del grupo de rutas (auth): login, register, forgot-password, etc.
 * El modo oscuro vive solo en el dashboard administrativo. Las pantallas
 * de autenticación tienen que mantenerse en claro independientemente del
 * `data-theme` persistido en localStorage por el ThemeToggle.
 */
// Recibe "children" → el contenido de la página de auth que se está visitando.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    // El fragmento de React (<>...</>) sirve para retornar múltiples
    // elementos sin agregar un <div> extra innecesario al DOM.
    <>
      {/* ForceLightTheme no renderiza nada visible, solo ejecuta un efecto
          que elimina el atributo data-theme='dark' del <html>.
          Esto evita que el fondo negro del dashboard "se cuele" en el login. */}
      <ForceLightTheme />
      {/* children es el page.tsx de la ruta actual (login, register, etc.) */}
      {children}
    </>
  );
}
