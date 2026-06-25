'use client';
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ force-light-theme.tsx                                                   │
// │                                                                         │
// │ ¿QUÉ HACE ESTE COMPONENTE?                                              │
// │ Es un componente de "efecto puro": no renderiza ningún elemento visual  │
// │ (devuelve null), pero al montarse ejecuta código que fuerza el tema     │
// │ claro en toda la aplicación, sobreescribiendo cualquier preferencia     │
// │ de modo oscuro que el usuario pudiera tener guardada.                   │
// │                                                                         │
// │ ¿POR QUÉ ES NECESARIO?                                                  │
// │ La plataforma tiene múltiples portales (marketplace, portal cliente,    │
// │ empleado). El modo oscuro SOLO está implementado para el dashboard de   │
// │ administrador. Si un admin habilitó el modo oscuro y luego visita el   │
// │ marketplace, toda la UI del marketplace se vería oscura sin querer.    │
// │ Este componente previene ese problema.                                  │
// │                                                                         │
// │ USO: Se coloca en el layout raíz de cada portal que NO soporta modo    │
// │ oscuro:                                                                  │
// │   export default function Layout({ children }) {                        │
// │     return <><ForceLightTheme />{children}</>;                          │
// │   }                                                                     │
// │                                                                         │
// │ CONCEPTO: data-theme="light"                                            │
// │ Es un atributo HTML personalizado en el elemento <html> raíz.           │
// │ El sistema de temas del proyecto usa este atributo para aplicar         │
// │ las variables CSS correctas (colores, sombras, etc.) para cada tema.   │
// └─────────────────────────────────────────────────────────────────────────┘

// useEffect: ejecutar código DESPUÉS de que React renderiza el componente.
// En este caso lo usamos para acceder al DOM (document.documentElement).
import { useEffect } from 'react';

/**
 * Forza el tema claro en el árbol donde se monta. Se usa en layouts no-admin
 * (marketplace, portal cliente, empleado, platform) porque el modo oscuro
 * sólo está habilitado en el dashboard de administrador por ahora — el
 * resto se mostrará en oscuro de forma involuntaria si el usuario ya tenía
 * `localStorage.theme = "dark"` cuando entra desde otro portal.
 *
 * Cuando se desmonta NO restaura nada: el toggle del dashboard volverá a
 * leer su preferencia desde localStorage al re-montar.
 */
export function ForceLightTheme() {

  // ─── EFECTO: Aplicar tema claro al montar ─────────────────────────────────
  // [] como segundo argumento → se ejecuta SOLO UNA VEZ cuando el componente
  // aparece en pantalla (al montar), nunca más después.
  useEffect(() => {
    // Verificamos que estamos en el navegador (no en el servidor de Next.js).
    // Durante el SSR (Server-Side Rendering), "document" no existe porque
    // estamos en Node.js, no en el navegador. Esta verificación evita errores.
    if (typeof document === 'undefined') return;

    // document.documentElement → es el elemento <html> raíz de la página.
    // .dataset → la colección de atributos "data-*" del elemento.
    // .theme = 'light' → establece data-theme="light" en el <html>.
    //
    // Resultado en el HTML: <html data-theme="light" ...>
    //
    // El sistema de temas de Tailwind/CSS lee este atributo y aplica las
    // variables CSS del tema claro, sobreescribiendo cualquier tema oscuro.
    document.documentElement.dataset.theme = 'light';

    // Este efecto NO tiene función de limpieza (no devuelve nada).
    // Al desmontarse, el atributo data-theme queda en "light" en el DOM.
    // El dashboard, cuando se monta, leerá localStorage y aplicará su propia preferencia.
  }, []); // Dependencias vacías = ejecutar solo al montar

  // Este componente no renderiza ningún elemento visual en la pantalla.
  // Devolver null es perfectamente válido en React: significa "no renderices nada".
  return null;
}
