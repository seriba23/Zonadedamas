// ─────────────────────────────────────────────────────────────────────────────
// apps/web/src/app/qr/[tenantSlug]/page.tsx
//
// CONCEPTO: Página de redirección para códigos QR de negocios.
// URL: /qr/[tenantSlug]  (ej. /qr/salon-maria)
//
// Cuando un negocio genera un código QR para colocar en su local, ese QR
// apunta a esta URL. Esta página NO muestra contenido: simplemente redirige
// al perfil del negocio en el marketplace.
//
// PARÁMETROS OPCIONALES:
//  ?location=ID → redirige al marketplace con la sucursal pre-seleccionada
//
// IMPORTANTE: Este es un SERVER COMPONENT (sin 'use client').
// La función redirect() de Next.js solo funciona en el servidor.
// Esto es una ventaja: la redirección ocurre en el servidor (más rápido)
// sin necesidad de cargar JavaScript en el cliente.
//
// Diferencia con router.replace(): "redirect()" es del servidor,
// "router.replace()" es del cliente. En Server Components se usa redirect().
// ─────────────────────────────────────────────────────────────────────────────

// redirect: función de Next.js para redirigir desde el servidor.
// Lanza una excepción especial que Next.js intercepta para hacer la redirección.
import { redirect } from 'next/navigation';

// El componente recibe "params" y "searchParams" directamente como props.
// En los Server Components del App Router, Next.js inyecta estas props automáticamente.
//  params: parámetros de la ruta dinámica (el [tenantSlug])
//  searchParams: parámetros de la query string (?location=xxx)
export default function QrRedirect({
  params,
  searchParams,
}: {
  params: { tenantSlug: string };
  searchParams: { location?: string };  // "?" = el parámetro location es opcional
}) {
  // Construimos la URL de destino según si viene o no el parámetro "location".
  // Si viene ?location=ID → añadimos ese parámetro al marketplace para pre-seleccionar
  // la sucursal donde el cliente escaneó el QR.
  const url = searchParams.location
    ? `/marketplace/${params.tenantSlug}?location=${searchParams.location}`
    : `/marketplace/${params.tenantSlug}`;

  // redirect() hace la redirección HTTP 307 (Temporary Redirect) en el servidor.
  // El navegador del usuario nunca llega a ver esta página:
  // recibe directamente la respuesta del marketplace.
  redirect(url);
}
