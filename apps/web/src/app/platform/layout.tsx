// ============================================================
// ARCHIVO: apps/web/src/app/platform/layout.tsx
// PROPÓSITO: Layout (estructura envolvente) de toda la sección
// /platform del Super Admin.
//
// En Next.js App Router, el archivo "layout.tsx" de una carpeta
// ENVUELVE a todos los "page.tsx" que estén dentro de esa carpeta
// y sus subcarpetas. Funciona como una "plantilla" que se mantiene
// mientras el usuario navega entre páginas del área /platform.
//
// ESTE ARCHIVO DEFINE:
// 1. PlatformSidebar: la barra lateral de navegación (menú izquierdo)
// 2. PlatformLayoutInner: lógica de autenticación + estructura de la pantalla
// 3. PlatformLayout: componente raíz que envuelve todo con el proveedor de autenticación
//
// FLUJO DE RENDERIZADO:
//   PlatformLayout
//   └── PlatformAuthProvider (contexto global de auth del super admin)
//       ├── ForceLightTheme (fuerza modo claro en esta área)
//       └── PlatformLayoutInner
//           ├── Si está en /platform/login → solo muestra {children} (sin sidebar)
//           ├── Si está cargando → muestra spinner
//           ├── Si NO está autenticado → redirige a /platform/login
//           └── Si está autenticado → muestra sidebar + contenido de la página
// ============================================================

// 'use client': necesario porque usamos hooks de React (useState, useEffect)
// y el contexto de autenticación, que solo funcionan en el navegador.
'use client';

// useEffect: para ejecutar efectos secundarios (redirecciones, etc.)
// useState: para manejar el estado del menú móvil (abierto/cerrado)
import { useEffect, useState } from 'react';

// useRouter: para redirigir programáticamente (ej. al login si no está autenticado).
// usePathname: devuelve la ruta actual (ej. '/platform/tenants').
import { useRouter, usePathname } from 'next/navigation';

// Link: componente de Next.js para navegación entre páginas sin recargar.
// Es más eficiente que <a href="..."> porque usa el router interno.
import Link from 'next/link';

// PlatformAuthProvider: contexto que provee autenticación a toda la sección /platform.
// usePlatformAuth: hook para leer el estado de autenticación (user, isAuthenticated, logout).
import { PlatformAuthProvider, usePlatformAuth } from '@/lib/hooks/use-platform-auth';

// ForceLightTheme: componente que fuerza el modo claro (light) en esta sección,
// independientemente de la preferencia del sistema o configuración del usuario.
import { ForceLightTheme } from '@/components/ui/force-light-theme';

// ─────────────────────────────────────────────────────────
// COMPONENTE: PlatformSidebar
// Barra lateral izquierda de navegación del Super Admin.
//
// PROPS (propiedades que recibe del componente padre):
//   - mobileOpen: boolean → si el menú está abierto en móvil
//   - onClose: () => void → función para cerrar el menú en móvil
//
// La barra es fija en escritorio (lg:translate-x-0) y se
// desliza hacia afuera en móvil (-translate-x-full) hasta
// que mobileOpen sea true (translate-x-0).
// ─────────────────────────────────────────────────────────
function PlatformSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  // pathname: ruta actual del navegador. Sirve para resaltar el ítem activo del menú.
  const pathname = usePathname();

  // user: datos del super admin logueado (nombre, email).
  // logout: función para cerrar sesión.
  const { user, logout } = usePlatformAuth();

  // navItems: arreglo de objetos con los datos de cada ítem del menú lateral.
  // Cada objeto tiene:
  //   - label: texto visible en el menú
  //   - href: ruta a la que lleva
  //   - icon: datos de la ruta SVG del ícono (el atributo "d" de un <path> SVG)
  const navItems = [
    { label: 'Dashboard', href: '/platform/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { label: 'Negocios', href: '/platform/tenants', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { label: 'Facturas', href: '/platform/invoices', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
    { label: 'Recordatorios de pago', href: '/platform/payment-reminders', icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0' },
    { label: 'Tipos de negocio', href: '/platform/business-types', icon: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0v.008' },
    { label: 'Servicios', href: '/platform/service-catalog', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { label: 'Profesiones', href: '/platform/professions', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Clases', href: '/platform/classes', icon: 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z M12 14l0 6' },
    { label: 'Reclutadores y creadores', href: '/platform/creators', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
    { label: 'Registros notif.', href: '/platform/notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  ];

  // ── RENDERIZADO DEL SIDEBAR ───────────────────────────
  return (
    // <aside>: etiqueta HTML semántica para contenido lateral.
    // Clases de posicionamiento:
    //   - fixed inset-y-0 left-0: pegado al lado izquierdo, altura completa
    //   - w-64: 256px de ancho
    //   - z-40: z-index 40 (por encima del contenido pero por debajo de modales)
    //   - transform transition-transform duration-200: animación de deslizamiento suave
    //   - lg:translate-x-0: en pantallas grandes (≥1024px), siempre visible
    //   - ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}: en móvil,
    //     visible si mobileOpen=true, oculto (fuera de pantalla) si false
    <aside
      className={`fixed inset-y-0 left-0 w-64 bg-gray-900 flex flex-col z-40 transform transition-transform duration-200 lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Cabecera del sidebar: logo "Super Admin" + botón cerrar (solo en móvil) */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-700">
        <span className="text-xl font-bold text-white">Super Admin</span>
        {/* Botón para cerrar el menú en móvil.
            "lg:hidden": en pantallas grandes está oculto (el sidebar siempre es visible). */}
        <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white p-1 -mr-1" aria-label="Cerrar menú">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            {/* Ícono de X (cerrar) */}
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Área de navegación con scroll vertical si hay muchos ítems */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {/* .map() recorre el arreglo navItems y genera un <li> por cada ítem.
              "item" representa el objeto actual en cada iteración.
              "key={item.href}": identificador único requerido por React para
              el reconciliador. Usa href porque es único para cada ítem. */}
          {navItems.map((item) => {
            // isActive: true si la URL actual ES exactamente item.href,
            // O si EMPIEZA con item.href + '/' (para rutas anidadas como /platform/tenants/123).
            // Operador "||": devuelve true si al menos una condición es verdadera.
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                {/* Link: componente de Next.js. Genera un <a> que navega sin recargar.
                    onClick={onClose}: en móvil, cierra el menú al hacer clic en un ítem. */}
                <Link
                  href={item.href}
                  onClick={onClose}
                  // Clases condicionales con ternario: si isActive es true → fondo gris oscuro,
                  // si false → texto gris con hover que lo ilumina.
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  {/* SVG del ícono. d={item.icon} es la ruta vectorial del ícono. */}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  {/* Texto del ítem */}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sección inferior: información del usuario + botón de cerrar sesión.
          Se muestra SOLO si "user" no es null (el operador && actúa como guarda). */}
      {user && (
        <div className="border-t border-gray-700 p-4">
          {/* Avatar + nombre y email del super admin */}
          <div className="flex items-center gap-3 mb-3">
            {/* Avatar con iniciales "SA" (Super Admin). Color primario de la plataforma. */}
            <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold">
              SA
            </div>
            <div className="min-w-0">
              {/* Nombre completo. "truncate": corta con "..." si es muy largo. */}
              <p className="text-sm font-medium text-white truncate">
                {user.firstName} {user.lastName}
              </p>
              {/* Email. También truncado si es muy largo. */}
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          {/* Botón de cerrar sesión.
              Primero llama a logout() del contexto (borra el token de memoria).
              Luego redirige a /platform/login con window.location.href para
              hacer una recarga completa de la página (resetea todo el estado). */}
          <button
            onClick={() => { logout(); window.location.href = '/platform/login'; }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 rounded-lg hover:bg-gray-800 hover:text-white transition-colors"
          >
            {/* Ícono de salida (flecha apuntando hacia afuera) */}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      )}
    </aside>
  );
}

// ─────────────────────────────────────────────────────────
// COMPONENTE: PlatformLayoutInner
// Estructura interna del layout: maneja la lógica de autenticación
// y decide qué mostrar según el estado.
//
// PROPS:
//   - children: React.ReactNode → el contenido de la página actual
//     (lo que está dentro de <PlatformLayoutInner>...</PlatformLayoutInner>).
//     En Next.js, children es la "página" que corresponde a la ruta activa.
// ─────────────────────────────────────────────────────────
function PlatformLayoutInner({ children }: { children: React.ReactNode }) {
  // isAuthenticated: true si hay un token válido de super admin.
  // isLoading: true mientras se verifica el token en localStorage.
  const { isAuthenticated, isLoading } = usePlatformAuth();

  // router y pathname: para redirigir y saber en qué página estamos.
  const router = useRouter();
  const pathname = usePathname();

  // mobileOpen: controla si el menú lateral está abierto en móvil.
  const [mobileOpen, setMobileOpen] = useState(false);

  // EFECTO 1: Guarda de autenticación.
  // Si terminó de cargar (!isLoading) Y no está autenticado Y NO estamos
  // ya en el login (para evitar bucle infinito), redirige al login.
  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== '/platform/login') {
      router.replace('/platform/login');
    }
  }, [isAuthenticated, isLoading, pathname, router]);
  // Las dependencias del arreglo [...] hacen que este efecto se re-ejecute
  // cada vez que alguna de esas variables cambie.

  // Cerrar el drawer al navegar
  // EFECTO 2: Cierra el menú móvil cuando cambia la ruta (el usuario navegó).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]); // Se ejecuta cada vez que pathname cambia.

  // Login page doesn't need sidebar
  // Si estamos en /platform/login, solo renderizamos el contenido de la página
  // sin el sidebar ni la estructura del layout. El login tiene su propio diseño.
  if (pathname === '/platform/login') {
    // <>{children}</> es un Fragment: envuelve children sin añadir un nodo DOM extra.
    return <>{children}</>;
  }

  // Mientras se verifica la autenticación, muestra un spinner de carga.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          {/* "animate-spin": Tailwind anima el SVG girando continuamente. */}
          <svg className="animate-spin h-8 w-8 text-primary-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado (y no está cargando), no renderiza nada.
  // El efecto de arriba habrá lanzado ya la redirección al login.
  if (!isAuthenticated) return null;

  // ── ESTRUCTURA PRINCIPAL (usuario autenticado) ────────
  return (
    // Contenedor de pantalla completa con fondo gris claro.
    <div className="h-screen bg-gray-100">

      {/* Barra superior para móvil (visible solo en pantallas < 1024px).
          "lg:hidden": en escritorio (lg = ≥1024px) esta barra está oculta. */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-gray-900 flex items-center px-4 z-20">
        {/* Botón hamburguesa (≡) para abrir el menú lateral en móvil. */}
        <button onClick={() => setMobileOpen(true)} className="text-white p-1 -ml-1" aria-label="Abrir menú">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            {/* Tres líneas horizontales (ícono de menú hamburguesa). */}
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="ml-3 text-base font-bold text-white">Super Admin</span>
      </div>

      {/* Overlay (fondo oscuro semitransparente) que aparece detrás del menú
          cuando está abierto en móvil. Al hacer clic cierra el menú.
          "lg:hidden": en escritorio no se necesita overlay porque el sidebar es fijo.
          "bg-black/50": negro con 50% de opacidad.
          Solo se renderiza si mobileOpen es true (&&). */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setMobileOpen(false)} />
      )}

      {/* Barra lateral de navegación.
          Recibe el estado de apertura y la función para cerrar. */}
      <PlatformSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Área de contenido principal, a la derecha del sidebar.
          "lg:ml-64": en escritorio, deja 256px de margen izquierdo para el sidebar.
          "pt-14": en móvil, empuja el contenido hacia abajo para que no quede
                   tapado por la barra superior móvil (14 = 56px de altura).
          "lg:pt-0": en escritorio, no hay barra superior, así que sin padding-top. */}
      <div className="lg:ml-64 h-full overflow-y-auto pt-14 lg:pt-0">
        {/* El contenido de la página actual (la "page.tsx" correspondiente a la ruta). */}
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL: PlatformLayout
// Es el que Next.js usa como layout. Exportado por defecto.
//
// PROPS:
//   - children: el contenido de la página actual (pasado por Next.js).
//
// Envuelve todo con PlatformAuthProvider para que todos los
// componentes hijos puedan acceder al contexto de autenticación
// de la plataforma (user, login, logout, etc.) con usePlatformAuth().
// ─────────────────────────────────────────────────────────
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    // PlatformAuthProvider: provee el contexto de auth a toda la sección.
    <PlatformAuthProvider>
      {/* ForceLightTheme: garantiza que el Super Admin siempre se vea en modo claro. */}
      <ForceLightTheme />
      {/* PlatformLayoutInner: maneja la lógica de auth y la estructura visual. */}
      <PlatformLayoutInner>{children}</PlatformLayoutInner>
    </PlatformAuthProvider>
  );
}
