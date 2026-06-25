// ============================================================
// ARCHIVO: apps/web/src/app/marketplace/bottom-nav.tsx
// ROL: Barra de navegación inferior fija del marketplace.
//
// ¿Qué es el Bottom Nav?
//   En apps móviles, la navegación principal suele estar en la parte
//   inferior de la pantalla (como en Instagram, WhatsApp, etc.).
//   Este componente renderiza una barra fija con 4 tabs:
//     1. Negocios → /marketplace (pantalla principal del marketplace)
//     2. Citas → /marketplace/appointments (lista de citas del usuario)
//     3. Cupones → /marketplace/coupons (cupones y recompensas)
//     4. Perfil → /marketplace/profile (perfil del usuario)
//
// ¿Cuándo se oculta?
//   - En páginas de login/registro (no tiene sentido navegar sin sesión).
//   - Cuando se accede con ?fromAdmin=1 (modo previsualización de admin).
//
// Patrón de "tab activo":
//   Comparamos la ruta actual (pathname) con el href de cada tab.
//   Si coincide → pintamos el ícono y texto en color teal.
//   Si no coincide → los pintamos en gris.
// ============================================================

// 'use client': necesario por el uso de hooks (usePathname, useSearchParams).
'use client';

// Link: componente de Next.js para navegación entre páginas.
// Produce un <a> HTML pero con pre-fetching automático y sin recargar
// la página completa (navegación del lado del cliente / client-side).
import Link from 'next/link';

// usePathname: devuelve la ruta URL actual como string.
// useSearchParams: devuelve los query params de la URL (ej: ?fromAdmin=1).
import { usePathname, useSearchParams } from 'next/navigation';

// ─── Constante de color principal ──────────────────────────────────
// Guardamos el color teal en una constante para reutilizarlo.
// Esto evita errores tipográficos si necesitamos cambiar el color:
// lo cambiamos en un solo lugar.
const TEAL = '#008080';

// ─── Definición de los tabs (pestañas de navegación) ───────────────
// Array de objetos, cada uno describe un tab de la barra inferior.
// Cada objeto tiene:
//   href: string → la ruta a la que navega al hacer click.
//   label: string → el texto que se muestra debajo del ícono.
//   matchPaths?: string[] → rutas adicionales que activan este tab
//     (solo usado en "Negocios" para incluir /marketplace/professionals).
//   icon: función → recibe un booleano (active) y devuelve JSX del ícono SVG.
//     Según active, el ícono usa TEAL o gris (#9ca3af).
const tabs = [
  {
    // Tab "Negocios": ruta principal del marketplace.
    href: '/marketplace',
    label: 'Negocios',
    // matchPaths: este tab se considera activo cuando estamos en
    // /marketplace O en /marketplace/professionals. Sin matchPaths,
    // usar solo href === pathname no activaría el tab al entrar a /professionals.
    matchPaths: ['/marketplace', '/marketplace/professionals'],
    // icon es una función que recibe active: boolean y devuelve el SVG.
    // Si active=true → el SVG se pinta con color TEAL (teal sólido).
    // Si active=false → sin relleno y borde gris (#9ca3af).
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill={active ? TEAL : 'none'} viewBox="0 0 24 24" strokeWidth={1.8} stroke={active ? TEAL : '#9ca3af'}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72" />
      </svg>
    ),
  },
  {
    // Tab "Citas": lista de citas del usuario en el marketplace.
    href: '/marketplace/appointments',
    label: 'Citas',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke={active ? TEAL : '#9ca3af'}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    // Tab "Cupones": cupones activos del usuario (recompensas canjeadas).
    href: '/marketplace/coupons',
    label: 'Cupones',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke={active ? TEAL : '#9ca3af'}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    ),
  },
  {
    // Tab "Perfil": página de perfil del usuario cliente.
    href: '/marketplace/profile',
    label: 'Perfil',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke={active ? TEAL : '#9ca3af'}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

// ─── Rutas donde el BottomNav se oculta completamente ───────────────
// En login y registro no tiene sentido mostrar el nav inferior.
const HIDDEN_PATHS = ['/marketplace/login', '/marketplace/register'];

// ─── Componente BottomNav ────────────────────────────────────────────
// No recibe props: lee todo del contexto de Next.js (pathname, searchParams).
export function BottomNav() {
  // pathname: ruta actual del navegador.
  const pathname = usePathname();

  // searchParams: parámetros de la URL. Usamos .get('fromAdmin') para saber
  // si el administrador está previsualizando el marketplace.
  const searchParams = useSearchParams();
  // Modo preview admin (?fromAdmin=1 desde /settings/business): no mostramos
  // el nav porque el admin solo viene a ver, no a navegar el portal cliente.
  const fromAdmin = searchParams.get('fromAdmin') === '1';

  // Renderizado condicional con retorno anticipado:
  // Si estamos en una ruta oculta (login/registro), retornamos null = nada.
  // En React, devolver null hace que el componente no renderice nada.
  if (HIDDEN_PATHS.some((p) => pathname.startsWith(p))) return null;

  // Si es modo admin, tampoco mostramos el nav.
  if (fromAdmin) return null;

  return (
    // fixed bottom-0: posición fija en la parte inferior de la pantalla.
    // left-0 right-0: se extiende de extremo a extremo del ancho.
    // z-40: z-index alto para estar por encima del contenido.
    // bg-white border-t: fondo blanco con borde superior gris.
    // safe-bottom: respeta el "notch" inferior en iPhones (safe area).
    // style paddingBottom env(safe-area-inset-bottom): espacio extra
    //   en iPhones con pantalla tipo Dynamic Island / Face ID.
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-bottom"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* max-w-2xl mx-auto: centra el contenido con ancho máximo de ~672px.
          flex items-center: los tabs se alinean horizontalmente, centrados. */}
      <div className="max-w-2xl mx-auto flex items-center">
        {/* Iteramos sobre el array tabs con .map() para renderizar cada tab.
            .map() transforma cada elemento del array en JSX.
            Cada elemento devuelto necesita una prop key única para que React
            pueda identificar qué elemento cambió en re-renders.
            Aquí usamos tab.href como key (es único en el array). */}
        {tabs.map((tab) => {
          // Calculamos si el tab actual está "activo" (la ruta coincide).
          // Usamos (tab as any) porque TypeScript no sabe que algunos tabs
          // tienen matchPaths y otros no (el tipo no lo declara explícitamente).
          const active = (tab as any).matchPaths
            // Si el tab tiene matchPaths, verificamos si alguna de esas rutas
            // coincide con el pathname actual:
            //   - Para '/marketplace' hacemos igualdad exacta (pathname === p)
            //     para no activar el tab en /marketplace/profile, etc.
            //   - Para '/marketplace/professionals' usamos startsWith.
            ? (tab as any).matchPaths.some((p: string) => p === '/marketplace' ? pathname === p : pathname.startsWith(p))
            // Si no tiene matchPaths: el tab "/" se activa solo si es exactamente
            // igual; los demás usan startsWith para activarse en sub-rutas.
            : tab.href === '/marketplace'
              ? pathname === '/marketplace'
              : pathname.startsWith(tab.href);

          return (
            // Link: navega a tab.href al hacer click.
            // key={tab.href}: identificador único para React.
            // flex-1: cada tab ocupa el mismo espacio horizontal.
            // flex flex-col items-center justify-center: ícono encima del texto.
            // py-2 gap-0.5: espaciado vertical y entre ícono y texto.
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
            >
              {/* tab.icon(active): llamamos a la función icon del tab,
                  pasándole el booleano active. La función devuelve el SVG
                  con el color correspondiente (teal si activo, gris si no). */}
              {tab.icon(active)}

              {/* Texto del tab. El color se aplica con style inline
                  para poder usar la variable TEAL dinámica.
                  Si active → color teal. Si no → gris (#9ca3af). */}
              <span
                className="text-[10px] font-medium"
                style={{ color: active ? TEAL : '#9ca3af' }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
