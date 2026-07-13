// ─────────────────────────────────────────────────────────────────────────────
// SectionHelp — ícono ⓘ en el header que abre el onboarding de la sección actual.
//
// Toma la ruta actual, busca sus slides en el registro (section-help-content) y
// muestra un ícono ⓘ. Se abre SOLO a demanda (al pulsar el ícono): no aparece
// automáticamente, así no molesta a quienes ya usan la app. Si la sección no
// tiene onboarding definido, no pinta nada.
//
// Es centralizado: se coloca una vez en el header y funciona en todas las
// secciones; el contenido vive en section-help-content.ts.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { OnboardingCarousel } from './onboarding-carousel';
import { getSectionHelp, getSectionHelpByKey } from '@/lib/section-help-content';
import { useSectionHelpOverride } from '@/lib/section-help-context';

// className: permite ajustar el estilo del botón (p. ej. más compacto en el
// marketplace) sin afectar al resto de portales. Si se omite, usa el estilo por
// defecto del panel de administración.
export function SectionHelp({ className }: { className?: string } = {}) {
  const pathname = usePathname();
  // Si una página con pestañas fijó un "key" (override), usamos ESE; si no, la ruta.
  const override = useSectionHelpOverride();
  const help = override ? getSectionHelpByKey(override) : getSectionHelp(pathname || '');
  const [open, setOpen] = useState(false);

  // Al cambiar de sección, cerramos cualquier ayuda que hubiera quedado abierta.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!help) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Cómo funciona: ${help.title}`}
        title={`¿Cómo funciona ${help.title}?`}
        className={className ?? 'p-2 rounded-lg text-[var(--text-secondary)] hover:text-[#008080] hover:bg-[var(--bg-muted)] transition-colors'}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      </button>

      {open && (
        <OnboardingCarousel
          slides={help.slides}
          theme="light"
          accent="#008080"
          doneLabel="Entendido"
          onDone={() => setOpen(false)}
          onSkip={() => setOpen(false)}
        />
      )}
    </>
  );
}
