// ─────────────────────────────────────────────────────────────────────────────
// /creator/intro — Presentación del programa de RECLUTAMIENTO (pantalla negra).
//
// Es lo primero que ve alguien que entra al programa desde el menú de su perfil.
// Explica en 3 slides deslizables (swipe →) para qué sirve, cómo se comisiona y
// que el pago cae directo a su tarjeta de débito. Un botón "Acceder" lleva al
// login de reclutadores.
//
// SOLO se muestra la PRIMERA vez: si la persona ya accedió antes (marca en
// localStorage o token de reclutador presente), saltamos directo al login para
// no repetirle la explicación cada vez.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCreatorToken, INTRO_SEEN_KEY, markCreatorIntroSeen } from '@/lib/creator-auth';

// Los 3 pasos de la presentación. Cada uno: icono (path SVG), título y texto.
const SLIDES = [
  {
    icon: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46',
    title: 'Recomienda y gana',
    text: 'Reclutas negocios y profesionales para Siliba con tu código único. Cada vez que alguien se registra con tu código, queda ligado a ti.',
  },
  {
    icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    title: 'Comisiones cada mes',
    text: 'Tu referido recibe descuento sus primeros 2 meses. A partir del mes 3, mientras siga activo, tú ganas cada mes: $50 por cada negocio y $25 por cada profesional.',
  },
  {
    icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
    title: 'Directo a tu tarjeta',
    text: 'Conectas tu cuenta de cobros una sola vez y tus comisiones se depositan automáticamente a tu tarjeta de débito cada mes.',
  },
];

export default function CreatorIntroPage() {
  const router = useRouter();
  // scroller: referencia al carrusel para calcular en qué slide estamos.
  const scroller = useRef<HTMLDivElement>(null);
  // active: índice del slide visible (para pintar los puntos).
  const [active, setActive] = useState(0);
  // ready: hasta no comprobar si debe saltarse la intro, no pintamos nada
  // (evita el parpadeo de la presentación para quien ya accedió).
  const [ready, setReady] = useState(false);

  // Al montar: si ya vieron la intro (o tienen sesión de reclutador activa),
  // saltamos directo al login sin mostrar la presentación.
  useEffect(() => {
    const seen =
      typeof window !== 'undefined' &&
      (localStorage.getItem(INTRO_SEEN_KEY) === '1' || !!getCreatorToken());
    if (seen) {
      router.replace('/creator/login');
      return;
    }
    setReady(true);
  }, [router]);

  // onScroll: calcula el slide activo según la posición del scroll horizontal.
  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) setActive(i);
  }

  // goTo: desliza el carrusel al slide n (al tocar un punto).
  function goTo(n: number) {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
  }

  // acceder: marca la intro como vista (para no repetirla) y va al login.
  function acceder() {
    markCreatorIntroSeen();
    router.push('/creator/login');
  }

  // Mientras decidimos si saltar la intro, no pintamos (evita flash).
  if (!ready) return <div className="min-h-[100dvh] bg-black" />;

  const isLast = active === SLIDES.length - 1;

  return (
    <div className="min-h-[100dvh] bg-black text-white flex flex-col">
      {/* Cabecera: logo + "saltar" */}
      <div className="flex items-center justify-between px-5 pt-6">
        <span className="text-xl font-black tracking-tight">Siliba</span>
        <button onClick={acceder} className="text-sm text-white/50 hover:text-white/80 transition-colors">
          Saltar
        </button>
      </div>

      {/* Carrusel deslizable (scroll-snap horizontal). */}
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex-1 flex overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {SLIDES.map((s, i) => (
          <div
            key={i}
            className="min-w-full snap-center flex flex-col items-center justify-center px-8 text-center"
          >
            {/* Icono en círculo gris oscuro */}
            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gray-900 ring-1 ring-white/10">
              <svg className="h-11 w-11 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
              </svg>
            </div>
            <h2 className="text-2xl font-bold">{s.title}</h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">{s.text}</p>
          </div>
        ))}
      </div>

      {/* Puntos indicadores */}
      <div className="flex items-center justify-center gap-2 pb-6">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Ir al paso ${i + 1}`}
            className={`h-2 rounded-full transition-all ${i === active ? 'w-6 bg-white' : 'w-2 bg-white/30'}`}
          />
        ))}
      </div>

      {/* Acción: en los primeros slides "Siguiente" avanza; en el último, "Acceder". */}
      <div className="px-6 pb-8">
        <button
          onClick={() => (isLast ? acceder() : goTo(active + 1))}
          className="w-full rounded-xl bg-white py-3.5 text-sm font-bold text-black transition-opacity hover:opacity-90"
        >
          {isLast ? 'Acceder' : 'Siguiente'}
        </button>
      </div>
    </div>
  );
}
