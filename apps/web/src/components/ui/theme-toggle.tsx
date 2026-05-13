'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

/**
 * Toggle de modo oscuro. Lee/escribe `theme` en localStorage y aplica
 * `data-theme` en <html> para que las CSS vars cambien al instante.
 *
 * Para evitar flash de tema incorrecto al cargar, layout.tsx incluye un
 * script inline que setea data-theme antes del primer render.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved =
      typeof window !== 'undefined'
        ? (localStorage.getItem('theme') as Theme | null)
        : null;
    const initial: Theme = saved === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = initial;
    }
  }, []);

  function toggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
  }

  // Evitar hydration mismatch: hasta montar, renderear placeholder.
  const isDark = mounted && theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      className={`flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors ${className}`}
    >
      {isDark ? (
        // Sol (modo oscuro activo → ofrece cambiar a claro)
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        // Luna (modo claro activo → ofrece cambiar a oscuro)
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}
