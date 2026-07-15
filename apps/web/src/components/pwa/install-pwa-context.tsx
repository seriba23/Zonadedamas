'use client';

// ─────────────────────────────────────────────────────────────────────────────
// InstallPwaProvider / useInstallPwa: estado COMPARTIDO de instalación de la PWA.
//
// ¿Por qué un contexto y no lógica suelta en cada componente? El evento de
// Android `beforeinstallprompt` se dispara UNA sola vez al cargar la página. Si
// solo lo escuchara el banner, la pantalla "Instalar app" de Configuración (que
// se monta más tarde, al navegar) ya no lo tendría y no podría lanzar el diálogo
// nativo. Capturándolo una vez aquí (alto en el árbol) y guardándolo, tanto el
// banner como la pantalla de settings pueden ofrecer instalar.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Evento no estándar (Chromium). Lo tipamos a mano: no está en lib.dom.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPwaState {
  canPrompt: boolean;    // Android/desktop: hay diálogo nativo de instalación disponible.
  isStandalone: boolean; // La app ya corre instalada (pantalla de inicio / standalone).
  isIos: boolean;        // iPhone/iPad: no hay prompt nativo → instrucciones manuales.
  installed: boolean;    // Se instaló durante esta sesión.
  // Lanza el diálogo nativo (Android). Devuelve el resultado o 'unavailable' si
  // no hay prompt disponible (ej. iOS, o ya instalada).
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

const InstallPwaContext = createContext<InstallPwaState | null>(null);

// Hook de consumo. Devuelve null si se usa fuera del provider (defensivo).
export function useInstallPwa(): InstallPwaState | null {
  return useContext(InstallPwaContext);
}

function computeStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function computeIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOSDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS moderno se identifica como Mac con pantalla táctil.
  const iPadOS = /macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document;
  return iOSDevice || iPadOS;
}

export function InstallPwaProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setIsStandalone(computeStandalone());
    setIsIos(computeIos());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // evita el mini-infobar por defecto de Chrome.
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!deferred) return 'unavailable';
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null); // el prompt solo puede usarse una vez.
    if (outcome === 'accepted') setInstalled(true);
    return outcome;
  }

  return (
    <InstallPwaContext.Provider
      value={{ canPrompt: !!deferred, isStandalone, isIos, installed, promptInstall }}
    >
      {children}
    </InstallPwaContext.Provider>
  );
}
