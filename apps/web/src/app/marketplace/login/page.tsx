// ============================================================
// ARCHIVO: apps/web/src/app/marketplace/login/page.tsx
// ROL: Página de login del marketplace → redirige al login global.
//
// ¿Por qué existe esta página si solo redirige?
//   El marketplace comparte el sistema de autenticación con el resto
//   de la plataforma (panel de administración, portal de empleados).
//   El login unificado vive en /login (app global).
//   Esta página /marketplace/login solo sirve como "puente" que:
//     1. Captura el parámetro ?redirect de la URL.
//     2. Muestra una pantalla de "Redirigiendo..." mientras redirige.
//     3. Redirige a /login pasando el ?redirect para que tras el login
//        el usuario vuelva a donde intentaba ir.
//
// Ejemplo de flujo:
//   Usuario intenta entrar a /marketplace/profile sin sesión.
//   → AuthGuard redirige a /marketplace/login?redirect=%2Fmarketplace%2Fprofile
//   → Esta página redirige a /login?redirect=%2Fmarketplace%2Fprofile
//   → El usuario inicia sesión en /login.
//   → /login lo lleva de vuelta a /marketplace/profile.
//
// ¿Por qué Suspense?
//   useSearchParams() necesita estar dentro de un <Suspense> en Next.js
//   App Router cuando se usa en componentes de página. Sin Suspense,
//   la build falla porque Next.js no puede hacer pre-render estático
//   de páginas que leen query params en tiempo de render.
// ============================================================

// 'use client': usa hooks (useEffect, useRouter, useSearchParams).
'use client';

// Suspense: envuelve componentes que usan useSearchParams para
// permitir el pre-render estático de Next.js (build sin errores).
// useEffect: ejecuta la redirección después del primer render.
import { Suspense, useEffect } from 'react';

// useRouter: para hacer la redirección programática.
// useSearchParams: para leer ?redirect=... de la URL.
import { useRouter, useSearchParams } from 'next/navigation';

// ─── Componente interno que hace la redirección ─────────────────────
// Se separa en un componente propio para que pueda estar dentro de <Suspense>.
function MarketplaceLoginRedirect() {
  // router: objeto para navegar a otras páginas.
  const router = useRouter();

  // searchParams: objeto para leer los parámetros de la URL.
  const searchParams = useSearchParams();

  // redirect: valor del parámetro ?redirect en la URL actual.
  // Si la URL es /marketplace/login?redirect=%2Fmarketplace%2Fprofile,
  // entonces redirect = "/marketplace/profile" (decodificado automáticamente).
  // Si no hay parámetro redirect, searchParams.get('redirect') devuelve null.
  const redirect = searchParams.get('redirect');

  // useEffect: se ejecuta una vez al montarse el componente.
  // El array [router, redirect] son las dependencias: si cambian,
  // el efecto se re-ejecuta (aunque aquí eso no ocurrirá en la práctica).
  useEffect(() => {
    // Construimos la URL de destino:
    // Si hay redirect → /login?redirect=<valorRedirect> (codificado para URL segura).
    // Si no hay redirect → /login (va al login global sin redirección post-login).
    // encodeURIComponent() asegura que caracteres especiales (/, ?, &, =) se
    // codifiquen correctamente para ser parámetros de URL válidos.
    const target = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login';

    // router.replace(): navega a target sin guardar /marketplace/login
    // en el historial. Así el botón "Atrás" del navegador no vuelve aquí.
    router.replace(target);
  }, [router, redirect]);

  // Mientras ocurre la redirección (es instantánea pero existe un tick),
  // mostramos una pantalla simple de "Redirigiendo...".
  return (
    // Pantalla completa centrada con fondo gris claro.
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {/* Spinner de carga circular:
            - inline-block: para que tenga tamaño definido.
            - w-8 h-8: 32x32px.
            - border-2: borde de 2px.
            - border-[#008080]: borde teal en 3 lados.
            - border-t-transparent: borde superior transparente (crea el efecto girador).
            - rounded-full: forma de círculo.
            - animate-spin: animación de rotación continua (clase de Tailwind). */}
        <div className="inline-block w-8 h-8 border-2 border-[#008080] border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-gray-500">Redirigiendo al inicio de sesión…</p>
      </div>
    </div>
  );
}

// ─── Componente principal de la página ──────────────────────────────
// Es el export default que Next.js usa como la página de /marketplace/login.
// Envuelve MarketplaceLoginRedirect en Suspense para que Next.js pueda
// hacer el build sin errores (useSearchParams necesita Suspense).
// fallback={null}: sin pantalla de carga, ya que la redirección es inmediata.
export default function MarketplaceLoginPage() {
  return (
    <Suspense fallback={null}>
      <MarketplaceLoginRedirect />
    </Suspense>
  );
}
