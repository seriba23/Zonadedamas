'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * useInfiniteScroll — paginación "en bloques" sin botón.
 *
 * Renderiza al inicio `step` elementos y, conforme el usuario llega al fondo del
 * scroll (un `sentinel` se asoma en la pantalla), va revelando otros `step` más
 * automáticamente. No hace peticiones nuevas: solo corta el array ya cargado.
 *
 * @param items     lista completa ya filtrada/ordenada.
 * @param resetKey  cadena que identifica "qué lista es". Cuando cambia (modo,
 *                  pestaña, filtros, búsqueda) el conteo vuelve a `step`.
 * @param step      tamaño del bloque (por defecto 30).
 *
 * Devuelve:
 *  - visibleItems: el sub-array que debe pintarse ahora.
 *  - hasMore:      true si aún quedan elementos por revelar.
 *  - sentinelRef:  ref para un <div> al final de la lista; al entrar en viewport
 *                  dispara la carga del siguiente bloque.
 */
export function useInfiniteScroll<T>(items: T[], resetKey: string, step = 30) {
  const [count, setCount] = useState(step);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Al cambiar de lista (modo/pestaña/filtros) reiniciamos a un solo bloque.
  useEffect(() => {
    setCount(step);
  }, [resetKey, step]);

  const hasMore = count < items.length;

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // rootMargin adelanta la carga ~300px antes de tocar el fondo, para que
        // la aparición se sienta fluida y sin "saltos" al final del scroll.
        if (entries[0].isIntersecting) setCount((c) => c + step);
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, step, count, items.length]);

  return {
    visibleItems: items.slice(0, count),
    hasMore,
    sentinelRef,
  };
}
