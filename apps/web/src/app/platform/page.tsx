// ============================================================
// ARCHIVO: apps/web/src/app/platform/page.tsx
// RUTA EN EL NAVEGADOR: /platform
//
// Este es el archivo de la RUTA RAÍZ del área de la plataforma
// (Super Admin). En Next.js App Router, cada carpeta puede tener
// un archivo "page.tsx" que define qué se muestra en esa URL.
//
// ¿QUÉ HACE ESTE ARCHIVO?
// Simplemente redirige al usuario a /platform/dashboard en cuanto
// se monta el componente. Así, ir a /platform es lo mismo que ir
// directamente a /platform/dashboard.
// ============================================================

// 'use client' le indica a Next.js que este componente se ejecuta
// en el NAVEGADOR (cliente), no en el servidor. Es necesario porque
// usamos hooks de React como useEffect y la API del router.
'use client';

// useEffect: hook de React que ejecuta código cuando el componente
// aparece en pantalla (o cuando cambian sus dependencias).
import { useEffect } from 'react';

// useRouter: hook de Next.js que da acceso al objeto "router",
// que permite navegar programáticamente entre páginas.
import { useRouter } from 'next/navigation';

// Componente de página por defecto exportado.
// En App Router, el componente exportado por defecto de "page.tsx"
// es el que Next.js renderiza cuando el usuario visita esa ruta.
export default function PlatformPage() {
  // router: objeto con métodos para navegar entre rutas.
  // - router.push('/ruta')    → navega dejando el historial
  // - router.replace('/ruta') → navega SIN dejar rastro en el historial
  //   (el usuario no puede volver atrás con el botón "Atrás" del navegador)
  const router = useRouter();

  // useEffect se ejecuta UNA SOLA VEZ cuando el componente aparece
  // en pantalla (porque el arreglo de dependencias [router] no cambia).
  // Redirige inmediatamente a /platform/dashboard.
  useEffect(() => {
    router.replace('/platform/dashboard');
  }, [router]);

  // El componente no renderiza nada visible (null).
  // El usuario nunca verá /platform porque será redirigido de inmediato.
  return null;
}
