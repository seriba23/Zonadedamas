// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVO: apps/web/src/app/portal/[tenantSlug]/portal-nav.tsx
//
// QUÉ ES ESTE ARCHIVO
// -------------------
// Barra de navegación inferior (bottom navigation) del portal del cliente.
// No es una "página" (no tiene URL propia) — es un COMPONENTE REUTILIZABLE
// que se importa en las páginas que lo necesitan (appointments, book, history,
// profile) y se renderiza en la parte inferior de la pantalla.
//
// QUÉ MUESTRA
// -----------
// Una barra fija en la parte baja de la pantalla con 4 botones de navegación:
//   - Citas (icono de calendario)
//   - Historial (icono de reloj)
//   - Reservar (icono de +)
//   - Perfil (icono de persona)
//
// La pestaña activa se muestra en teal (#008080) con trazo más grueso.
// Las inactivas se muestran en gris.
//
// PATRÓN DE DISEÑO: Bottom Navigation (estilo app móvil)
// -------------------------------------------------------
// Esta barra es la forma estándar de navegación en aplicaciones móviles.
// Al estar "fixed bottom-0", no se desplaza con el scroll — siempre visible.
// ─────────────────────────────────────────────────────────────────────────────

// 'use client': usamos hooks de React (usePathname, useClientAuth).
'use client';

// usePathname: hook de Next.js que devuelve la ruta actual de la URL.
// Ejemplo: si estamos en /portal/salon-lucia/appointments, devuelve ese string.
// Lo usamos para saber qué pestaña está activa.
import { usePathname } from 'next/navigation';

// Link: componente de Next.js para navegación sin recargar la página.
import Link from 'next/link';

// useClientAuth: hook personalizado que devuelve el contexto de autenticación
// del portal del cliente. Aquí solo necesitamos tenantSlug para construir las URLs.
import { useClientAuth } from '@/lib/hooks/use-client-auth';

// ── DEFINICIÓN DE LOS ÍTEMS DE LA BARRA ──────────────────────────────────────
// NAV_ITEMS: array de objetos con la configuración de cada botón de la barra.
// Centralizamos aquí los datos para que el JSX sea limpio — en lugar de repetir
// el mismo bloque 4 veces, iteramos este array con .map().
//
// Cada objeto tiene:
// - label: texto que aparece bajo el icono.
// - path: segmento de la URL (ej: 'appointments' → /portal/salon/appointments).
// - icon: string con el path SVG del icono. Los íconos son de Heroicons (librería
//   de íconos SVG open-source, compatible con Tailwind).
const NAV_ITEMS = [
  { label: 'Citas', path: 'appointments', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { label: 'Historial', path: 'history', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Reservar', path: 'book', icon: 'M12 4v16m8-8H4' },
  { label: 'Perfil', path: 'profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE: PortalNav
// Sin props — obtiene todo lo que necesita de los hooks.
// ─────────────────────────────────────────────────────────────────────────────
export default function PortalNav() {
  // pathname: la URL actual (ej: "/portal/salon-lucia/appointments").
  // Se actualiza automáticamente cada vez que el usuario navega.
  const pathname = usePathname();

  // tenantSlug: el identificador del negocio (ej: "salon-lucia").
  // Necesario para construir URLs correctas para cada tenant.
  const { tenantSlug } = useClientAuth();

  return (
    // nav: elemento semántico de HTML para barras de navegación.
    // fixed bottom-0 left-0 right-0: pegado al fondo de la ventana, ancho completo.
    // z-50: aparece por encima de todo el contenido de las páginas.
    // border-t: línea superior para separar visualmente la barra del contenido.
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      {/* max-w-lg mx-auto: centra el contenido en pantallas grandes (máx 512px). */}
      <div className="max-w-lg mx-auto flex">

        {/* Iteramos NAV_ITEMS para crear un Link por cada sección.
            item: cada objeto del array (con label, path, icon). */}
        {NAV_ITEMS.map((item) => {
          // Construimos la URL completa incluyendo el tenantSlug dinámico.
          // Ejemplo: /portal/salon-lucia/appointments
          const href = `/portal/${tenantSlug}/${item.path}`;

          // Verificamos si esta pestaña corresponde a la página actual.
          // pathname.includes(`/${item.path}`): true si la URL actual CONTIENE
          // el path del ítem. Por ejemplo, pathname incluye "/appointments" cuando
          // estamos en /portal/salon/appointments o /portal/salon/appointments/123.
          const isActive = pathname.includes(`/${item.path}`);

          return (
            // Link: navegación sin recarga de página.
            // key={item.path}: identificador único para React (requerido en listas).
            // flex-1: cada Link ocupa el mismo ancho (25% del total en 4 ítems).
            // flex flex-col items-center: ícono arriba, label abajo, centrado.
            <Link
              key={item.path}
              href={href}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
                // Ternario: color teal si activo, gris si inactivo.
                isActive
                  ? 'text-[#008080]'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {/* SVG del icono. strokeWidth varía según si está activo:
                  2 = más grueso (activo y visualmente destacado)
                  1.5 = normal (inactivo)
                  d={item.icon}: el "path" SVG que dibuja la forma del icono. */}
              <svg
                className="w-6 h-6 mb-0.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={isActive ? 2 : 1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>

              {/* Texto del ítem. font-medium si activo (negrita leve), normal si no. */}
              <span className={isActive ? 'font-medium' : ''}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
