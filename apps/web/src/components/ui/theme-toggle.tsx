// Componente de cliente: lee y escribe en localStorage (API solo del navegador).
'use client';

// Importamos dos hooks de React:
// - useEffect: para leer el tema guardado en localStorage después del primer render.
// - useState: para guardar el tema actual como estado reactivo.
import { useEffect, useState } from 'react';

// Definimos un tipo personalizado "Theme" que solo puede ser 'light' o 'dark'.
// "type" en TypeScript crea un alias de tipo; aquí es una "union type" (uno u otro).
type Theme = 'light' | 'dark';

/**
 * Toggle de modo oscuro. Lee/escribe `theme` en localStorage y aplica
 * `data-theme` en <html> para que las CSS vars cambien al instante.
 *
 * Para evitar flash de tema incorrecto al cargar, layout.tsx incluye un
 * script inline que setea data-theme antes del primer render.
 */
// Props del componente: solo acepta className opcional para personalizar estilos.
// { className = '' } en los parámetros desestructura la prop y le da valor por defecto.
export function ThemeToggle({ className = '' }: { className?: string }) {
  // Estado del tema actual. Empieza en 'light' como valor por defecto seguro.
  // Se actualiza en el useEffect con el valor guardado en localStorage.
  const [theme, setTheme] = useState<Theme>('light');

  // Estado que indica si el componente ya se montó en el navegador.
  // Empieza en false (en el servidor) y cambia a true en el navegador.
  // Necesario para evitar "hydration mismatch" (ver comentario abajo).
  const [mounted, setMounted] = useState(false);

  // useEffect con array vacío []: se ejecuta UNA SOLA VEZ después del primer render.
  // En Next.js, el servidor renderiza el HTML con el estado inicial (theme='light').
  // Luego el navegador "hidrata" (conecta) el HTML con React. Si en el navegador
  // el tema es 'dark', habría una discrepancia entre servidor y cliente (mismatch).
  // Por eso usamos "mounted" para no renderizar el ícono correcto hasta que estemos
  // seguros de que estamos en el navegador con el valor real del localStorage.
  useEffect(() => {
    // Marcamos que ya estamos en el navegador (montado).
    setMounted(true);

    // typeof window !== 'undefined': verificación de seguridad.
    // "window" no existe en Node.js (servidor), pero sí en el navegador.
    // Si esta verificación falla → returned null.
    const saved =
      typeof window !== 'undefined'
        ? // localStorage.getItem('theme') devuelve string o null.
          // El cast "as Theme | null" le dice a TypeScript que el valor es
          // 'light', 'dark', o null.
          (localStorage.getItem('theme') as Theme | null)
        : null;

    // Si el valor guardado es exactamente 'dark', usamos 'dark'.
    // En cualquier otro caso (null, 'light', valor inválido) usamos 'light'.
    const initial: Theme = saved === 'dark' ? 'dark' : 'light';

    // Actualizamos el estado con el tema real del usuario.
    setTheme(initial);

    // Aplicamos el tema al elemento raíz <html> del documento.
    // document.documentElement es el elemento <html>.
    // .dataset.theme accede al atributo HTML "data-theme".
    // Al cambiar "data-theme", las variables CSS del proyecto cambian
    // (definidas con :root[data-theme='dark'] { ... } en el CSS global).
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = initial;
    }
  }, []); // Array vacío → solo se ejecuta al montar, nunca más.

  // Función que alterna entre modo claro y oscuro.
  function toggle() {
    // Si el tema actual es 'light' → pasamos a 'dark', y viceversa.
    // Ternario: condición ? valor_si_true : valor_si_false
    const next: Theme = theme === 'light' ? 'dark' : 'light';

    // 1. Actualizamos el estado de React → provoca un re-render.
    setTheme(next);

    // 2. Actualizamos el atributo data-theme en <html> → las CSS vars cambian al instante.
    document.documentElement.dataset.theme = next;

    // 3. Guardamos la preferencia en localStorage → persiste entre recargas y sesiones.
    localStorage.setItem('theme', next);
  }

  // Evitar hydration mismatch: hasta montar, renderear placeholder.
  // isDark es true SOLO si: ya montamos (estamos en el navegador) Y el tema es 'dark'.
  // Antes de montar, isDark siempre es false → renderizamos el icono de luna (modo claro).
  // Esto asegura que el HTML del servidor y el del cliente coincidan en el primer render.
  const isDark = mounted && theme === 'dark';

  // ── JSX retornado ────────────────────────────────────────────────────────
  return (
    // Botón cuadrado de 36x36px (w-9 h-9). Sin borde, solo ícono.
    // - aria-label: etiqueta de accesibilidad para lectores de pantalla.
    //   Cambia según el estado: si es oscuro → ofrece "modo claro", y viceversa.
    // - title: tooltip que aparece al pasar el cursor.
    // - Las clases de color usan variables CSS (var(--...)) definidas en el tema.
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] ${className}`}
    >
      {/* Renderizado condicional con ternario:
          - isDark=true (modo oscuro activo): mostramos sol ☀ (para cambiar a claro).
          - isDark=false (modo claro activo): mostramos luna 🌙 (para cambiar a oscuro). */}
      {isDark ? (
        // Sol (modo oscuro activo → ofrece cambiar a claro)
        // SVG del sol: círculo central con rayos (líneas radiales).
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        // Luna (modo claro activo → ofrece cambiar a oscuro)
        // SVG de luna creciente: un círculo con otro círculo recortado.
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}
