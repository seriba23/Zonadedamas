// ─────────────────────────────────────────────────────────────────────────────
// SectionHelp — ícono ⓘ en el header que abre el onboarding de la sección actual.
//
// Toma la ruta actual, busca sus slides en el registro (section-help-content) y:
//   - Muestra un ícono ⓘ para abrir/repasar el onboarding cuando el usuario quiera.
//   - La PRIMERA vez que se entra a esa sección, lo muestra automáticamente
//     (marca por sección en localStorage: help_seen_<key>).
//   - Si la sección no tiene onboarding definido, no pinta nada.
//
// Es centralizado: se coloca una sola vez en el header y funciona en todas las
// secciones; el contenido vive en section-help-content.ts.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { OnboardingCarousel } from './onboarding-carousel';
import { getSectionHelp } from '@/lib/section-help-content';

export function SectionHelp() {
  const pathname = usePathname();
  const help = getSectionHelp(pathname || '');
  const [open, setOpen] = useState(false);

  // Auto-mostrar la primera vez que se visita esta sección (por su key).
  useEffect(() => {
    if (!help) return;
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(`help_seen_${help.key}`)) setOpen(true);
    // Al cambiar de sección, si la nueva no se ha visto, se auto-muestra.
  }, [help?.key]);

  if (!help) return null;

  // Cierra y recuerda que esta sección ya se vio (no reaparece sola).
  function close() {
    if (typeof window !== 'undefined' && help) {
      localStorage.setItem(`help_seen_${help.key}`, '1');
    }
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Cómo funciona: ${help.title}`}
        title={`¿Cómo funciona ${help.title}?`}
        className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[#008080] hover:bg-[var(--bg-muted)] transition-colors"
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
          onDone={close}
          onSkip={close}
        />
      )}
    </>
  );
}
