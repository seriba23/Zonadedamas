// ─────────────────────────────────────────────────────────────────────────────
// SectionHelpContext — permite que una página con PESTAÑAS le diga al ícono ⓘ del
// header qué ayuda mostrar según la pestaña activa (ayuda "consciente de pestaña").
//
// Por defecto el ⓘ decide su contenido por la RUTA. Pero páginas como Servicios
// (Servicios/Paquetes/Cupones) o Personal (Empleados/Permisos/Asistencias/…) son
// una sola URL con pestañas client-side. Con este contexto, la página fija el
// "help key" de su pestaña activa y el ⓘ lo usa en lugar del de la ruta.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface SectionHelpCtx {
  key: string | null; // key de ayuda a mostrar (override); null = usar la ruta.
  setKey: (k: string | null) => void;
}

// Valor por defecto seguro: si no hay Provider, setKey es un no-op (no rompe).
const SectionHelpContext = createContext<SectionHelpCtx>({ key: null, setKey: () => {} });

// Provider: envuelve el header (donde vive el ⓘ) y el contenido (las páginas).
export function SectionHelpProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<string | null>(null);
  return (
    <SectionHelpContext.Provider value={{ key, setKey }}>
      {children}
    </SectionHelpContext.Provider>
  );
}

// El ⓘ del header lee el override actual (o null si la página no fijó ninguno).
export function useSectionHelpOverride(): string | null {
  return useContext(SectionHelpContext).key;
}

// Una página con pestañas llama esto con el key de su pestaña activa. Se limpia
// solo al desmontar/cambiar (así al salir de la página el ⓘ vuelve a la ruta).
export function useSectionHelpKey(key: string | null) {
  const { setKey } = useContext(SectionHelpContext);
  useEffect(() => {
    setKey(key);
    return () => setKey(null);
  }, [key, setKey]);
}
