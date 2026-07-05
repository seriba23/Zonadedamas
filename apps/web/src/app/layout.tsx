// ─────────────────────────────────────────────────────────────────────────────
// apps/web/src/app/layout.tsx
//
// CONCEPTO: Root Layout (diseño raíz) del App Router de Next.js 14.
//
// En Next.js App Router, CADA carpeta dentro de "app/" puede tener un
// archivo "layout.tsx". El layout raíz (este archivo) es OBLIGATORIO y
// envuelve ABSOLUTAMENTE todas las páginas de la aplicación.
//
// Piénsalo como la "cáscara" HTML base: todo lo que pongas aquí aparece
// en todas las páginas sin excepción (el <html>, el <body>, proveedores
// globales, etc.).
//
// DIFERENCIA CLAVE CON LAS PÁGINAS:
//  - layout.tsx  → se REUTILIZA entre navegaciones (no se vuelve a montar)
//  - page.tsx    → es el contenido de UNA ruta específica
//
// IMPORTANTE: Este archivo NO tiene 'use client' → es un Server Component
// de Next.js por defecto. Los Server Components se renderizan en el servidor
// y NO pueden usar hooks de React (useState, useEffect, etc.) ni eventos
// del navegador. Están diseñados para cosas como metadata, estructura HTML
// base y carga de datos en el servidor.
// ─────────────────────────────────────────────────────────────────────────────

// Importamos los tipos de Next.js para metadata y viewport.
// "Metadata" describe el <head> de la página (título, descripción, iconos...).
// "Viewport" describe el <meta name="viewport"> que controla el zoom en móviles.
import type { Metadata, Viewport } from 'next';

// Importa los estilos CSS globales de Tailwind. Solo se importa aquí
// (una vez) y aplica a toda la aplicación.
import './globals.css';

// Configura la librería dayjs (manejo de fechas) con plugins de UTC
// y localización en español. Se importa aquí para que el servidor
// también tenga dayjs configurado (los Client Components tienen su
// propia copia — ver providers.tsx).
import '@/lib/dayjs-setup';

// El componente Providers envuelve la app con todos los contextos globales
// (React Query, AuthProvider). Lo veremos en providers.tsx.
import { Providers } from './providers';

// Modal global ESTÁNDAR de "guardado": se monta una vez y escucha showSaveSuccess().
import { SaveSuccessProvider } from '@/components/ui/save-success-provider';

// ─── FUENTE GLOBAL: Manrope ────────────────────────────────────────────────────
// next/font/google descarga y autohospeda la fuente (sin FOUC, sin request a
// Google en runtime). Exponemos --font-manrope; Tailwind la usa como `font-sans`.
import { Manrope } from 'next/font/google';
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

// ─── METADATA ────────────────────────────────────────────────────────────────
// "metadata" es un export especial que Next.js lee automáticamente para
// inyectar etiquetas <meta> en el <head> de las páginas. No necesitas
// escribir <head> manualmente: Next.js lo hace por ti.
export const metadata: Metadata = {
  // El título de la pestaña del navegador.
  title: 'Siliba',
  // Descripción para SEO y previsualizaciones al compartir en redes sociales.
  description: 'Tu confianza, en manos de profesionales. Reserva citas, gestiona tu negocio o trabaja como profesional.',
  // Nombre de la app cuando se instala como PWA (Progressive Web App).
  applicationName: 'Siliba',
  // Ruta al archivo manifest.webmanifest que describe la PWA
  // (iconos, nombre, colores, modo pantalla completa, etc.).
  manifest: '/manifest.webmanifest',
  // Iconos del favicon en distintos tamaños. Los navegadores eligen
  // el más apropiado según el contexto (barra de tareas, pestaña, etc.).
  icons: {
    icon: [
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    // Icono especial para dispositivos Apple (cuando el usuario agrega
    // la app a su pantalla de inicio en iPhone/iPad).
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // Configuración extra para que la app se comporte como una app nativa
  // cuando se agrega a la pantalla de inicio de un iPhone/iPad.
  appleWebApp: {
    capable: true,                         // Habilita el modo "standalone" (sin barra del navegador Safari).
    statusBarStyle: 'black-translucent',   // Estilo de la barra de estado de iOS.
    title: 'Siliba',                       // Nombre que aparece bajo el ícono en la pantalla de inicio.
  },
  // Evita que iOS convierta automáticamente números de teléfono en links azules.
  // Útil para que los precios o códigos no se confundan con teléfonos.
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes', // Reemplazo moderno de apple-mobile-web-app-capable.
  },
};

// ─── VIEWPORT ────────────────────────────────────────────────────────────────
// Controla cómo el navegador muestra la página en dispositivos móviles.
// Es equivalente a la etiqueta: <meta name="viewport" content="...">
export const viewport: Viewport = {
  width: 'device-width',   // El ancho de la página = ancho del dispositivo.
  initialScale: 1,          // Sin zoom inicial.
  maximumScale: 1,          // Impide que el usuario haga zoom (diseño fijo).
  userScalable: false,      // Deshabilita el pellizco para hacer zoom en iOS.
  viewportFit: 'cover',     // La app ocupa también el "notch" (muesca) del iPhone X y posteriores.
  themeColor: '#008080',    // Color teal de la barra del navegador en Android (modo tema).
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
// RootLayout es el componente que envuelve TODA la aplicación.
// Recibe "children" que representa el contenido de la página actual.
//
// PROP "children": En React, cuando un componente contiene a otros
// componentes o elementos HTML, esos hijos se reciben como la prop "children".
// Aquí, "children" será el contenido de cualquier page.tsx que el usuario visite.
//
// El tipo "React.ReactNode" significa "cualquier cosa que React pueda renderizar":
// un elemento JSX, un string, un número, null, un array de elementos, etc.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // <html lang="es"> indica que el idioma del documento es español.
    // Esto es importante para lectores de pantalla y para los motores de búsqueda.
    <html lang="es" className={manrope.variable}>
      <head>
        {/* ── Script anti-flash de tema oscuro ──────────────────────────────
            PROBLEMA: Si el usuario eligió tema oscuro (guardado en localStorage),
            cuando la página carga hay un instante en que aparece en blanco/claro
            antes de que React aplique el tema. Ese destello se llama FOUC
            (Flash of Unstyled Content) o "flash de tema incorrecto".

            SOLUCIÓN: Este script se ejecuta de forma SINCRÓNICA antes del
            primer "paint" del navegador. Lee el localStorage y aplica
            data-theme='dark' en el elemento <html> antes de que nada se dibuje.

            "dangerouslySetInnerHTML" es la forma en React de insertar HTML/JS
            crudo. Se llama "dangerous" porque si metes contenido de usuarios
            puede ser un riesgo de seguridad (XSS). Aquí es seguro porque el
            contenido lo escribimos nosotros directamente en el código.

            El script usa una IIFE (Immediately Invoked Function Expression):
            (function(){ ... })()  → función que se define y ejecuta de inmediato.
            El try/catch evita errores si localStorage no está disponible
            (por ejemplo, en modo incógnito con restricciones). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.dataset.theme='dark';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans">
        {/* Providers envuelve toda la app con los contextos globales.
            Ver providers.tsx para entender qué proveedores se incluyen.
            "{children}" aquí representa el contenido de la ruta actual
            (el page.tsx correspondiente a la URL que el usuario visita). */}
        <Providers>{children}</Providers>
        {/* Modal estándar de guardado, disponible en toda la app. */}
        <SaveSuccessProvider />
      </body>
    </html>
  );
}
