// ─────────────────────────────────────────────────────────────────────────────
// OnboardingCarousel — presentación deslizable reutilizable (pantallas de intro).
//
// Es el patrón "onboarding" (carrusel de bienvenida): 2-3 slides que se deslizan
// (swipe →), con puntos de progreso, botón de acción y "Saltar". Se usa para
// explicar una función la primera vez (y se puede volver a abrir con un icono ⓘ).
//
// Reutilizable por TEMA:
//   - theme="light" → fondo blanco con acentos de color (por defecto teal).
//   - theme="dark"  → fondo negro (identidad tipo "premium", ej. reclutamiento).
//
// El componente solo pinta el carrusel; quién lo usa decide CUÁNDO mostrarlo
// (p.ej. con una marca en localStorage) y qué hace onDone/onSkip.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useRef, useState } from 'react';
// createPortal: monta el overlay directamente en <body>, para que quede a nivel
// raíz y cubra TODO, sin importar en qué contenedor (ej. el header) se use el
// componente. Sin esto, un contexto de apilamiento del padre podría dejar
// elementos por encima del onboarding.
import { createPortal } from 'react-dom';

// Un slide: icono (path SVG), título y texto corto.
export interface OnboardingSlide {
  icon: string;
  title: string;
  text: string;
}

interface OnboardingCarouselProps {
  slides: OnboardingSlide[];
  theme?: 'light' | 'dark';
  accent?: string; // color de acento (por defecto teal)
  doneLabel?: string; // texto del botón del último slide
  onDone: () => void; // al terminar / pulsar el botón final
  onSkip?: () => void; // si se pasa, muestra "Saltar" (por defecto = onDone)
}

export function OnboardingCarousel({
  slides,
  theme = 'light',
  accent = '#008080',
  doneLabel = 'Entendido',
  onDone,
  onSkip,
}: OnboardingCarouselProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const isDark = theme === 'dark';

  // Slide activo según el scroll horizontal.
  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) setActive(i);
  }

  function goTo(n: number) {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
  }

  const isLast = active === slides.length - 1;
  const skip = onSkip || onDone;

  // Paletas por tema.
  const bg = isDark ? 'bg-black text-white' : 'bg-white text-gray-900';
  const subtext = isDark ? 'text-white/60' : 'text-gray-500';
  const skipText = isDark ? 'text-white/50 hover:text-white/80' : 'text-gray-400 hover:text-gray-600';
  const iconWrap = isDark ? 'bg-gray-900 ring-1 ring-white/10' : 'ring-1';
  const dotOn = isDark ? 'bg-white' : '';
  const dotOff = isDark ? 'bg-white/30' : 'bg-gray-300';

  const content = (
    <div className={`fixed inset-0 z-[100] flex flex-col ${bg}`}>
      {/* Cabecera: "Saltar" a la derecha */}
      <div className="flex items-center justify-end px-5 pt-6">
        <button onClick={skip} className={`text-sm transition-colors ${skipText}`}>
          Saltar
        </button>
      </div>

      {/* Carrusel deslizable (scroll-snap horizontal) */}
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex-1 flex overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {slides.map((s, i) => (
          <div
            key={i}
            className="min-w-full snap-center flex flex-col items-center justify-center px-8 text-center"
          >
            <div
              className={`mb-8 flex h-24 w-24 items-center justify-center rounded-full ${iconWrap}`}
              style={isDark ? undefined : { backgroundColor: `${accent}14`, ['--tw-ring-color' as any]: `${accent}33` }}
            >
              <svg
                className="h-11 w-11"
                fill="none"
                stroke={isDark ? '#ffffff' : accent}
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
              </svg>
            </div>
            <h2 className="text-2xl font-bold">{s.title}</h2>
            <p className={`mt-3 max-w-xs text-sm leading-relaxed ${subtext}`}>{s.text}</p>
          </div>
        ))}
      </div>

      {/* Puntos indicadores */}
      <div className="flex items-center justify-center gap-2 pb-6">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Ir al paso ${i + 1}`}
            className={`h-2 rounded-full transition-all ${i === active ? 'w-6' : 'w-2'} ${
              i === active ? dotOn : dotOff
            }`}
            style={i === active && !isDark ? { backgroundColor: accent } : undefined}
          />
        ))}
      </div>

      {/* Acción: "Siguiente" hasta el último, luego el botón final */}
      <div className="px-6 pb-8">
        <button
          onClick={() => (isLast ? onDone() : goTo(active + 1))}
          className={`w-full rounded-xl py-3.5 text-sm font-bold transition-opacity hover:opacity-90 ${
            isDark ? 'bg-white text-black' : 'text-white'
          }`}
          style={isDark ? undefined : { backgroundColor: accent }}
        >
          {isLast ? doneLabel : 'Siguiente'}
        </button>
      </div>
    </div>
  );

  // En SSR no existe document; no renderizamos el portal allí.
  if (typeof document === 'undefined') return null;
  // Montamos el overlay en <body> para que cubra toda la pantalla.
  return createPortal(content, document.body);
}
