'use client';

// ─────────────────────────────────────────────────────────────────────────────
// InstallPwaBanner: banner superior tipo "Pinterest" que sugiere instalar Siliba
// como app (PWA). Es el paso PREVIO necesario para que las notificaciones push
// funcionen en iPhone (Apple solo permite push web en apps agregadas a la
// pantalla de inicio).
//
// El estado de instalabilidad viene del InstallPwaProvider (contexto compartido),
// así que este banner y la pantalla "Instalar app" de Configuración usan la MISMA
// fuente. Si el usuario cierra el banner, se recuerda 7 días en localStorage;
// para instalar después siempre puede ir a Configuración → Instalar app.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { useInstallPwa } from './install-pwa-context';

const DISMISS_KEY = 'siliba:install-banner-dismissed-at';
// Si el usuario lo descarta, no volvemos a molestar por 7 días.
const DISMISS_DAYS = 7;

function dismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const when = parseInt(raw, 10);
    if (Number.isNaN(when)) return false;
    const days = (Date.now() - when) / (1000 * 60 * 60 * 24);
    return days < DISMISS_DAYS;
  } catch {
    return false;
  }
}

export function InstallPwaBanner() {
  const install = useInstallPwa();
  // Leemos el descarte SOLO en cliente (evita desajuste de hidratación).
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(dismissedRecently());
  }, []);

  if (!install) return null;
  const { canPrompt, isStandalone, isIos, installed, promptInstall } = install;

  // No mostrar si: ya instalada, se instaló recién, se descartó hace poco, o no
  // hay forma de instalar (ni prompt de Android ni es iOS).
  if (isStandalone || installed || dismissed) return null;
  const mode: 'android' | 'ios' | null = canPrompt ? 'android' : isIos ? 'ios' : null;
  if (!mode) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* localStorage puede fallar en modo privado; ignoramos */
    }
    setDismissed(true);
  }

  async function handleInstall() {
    const outcome = await promptInstall();
    if (outcome !== 'accepted') dismiss(); // si lo rechaza, no insistimos por unos días.
  }

  return (
    <div className="bg-[#008080] text-white">
      <div className="mx-auto flex items-center gap-3 px-4 py-2.5 max-w-5xl">
        {/* Ícono app */}
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-base font-extrabold">
          S
        </span>

        <div className="flex-1 min-w-0">
          {mode === 'android' ? (
            <p className="text-sm font-medium leading-tight">
              Instala Siliba para recibir notificaciones y abrirla como app.
            </p>
          ) : (
            <p className="text-sm font-medium leading-tight">
              Para recibir notificaciones en tu iPhone: toca{' '}
              <span className="inline-flex items-center font-semibold">
                Compartir
                {/* Ícono "compartir" de iOS */}
                <svg className="w-4 h-4 mx-0.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
                </svg>
              </span>{' '}
              y luego <span className="font-semibold">«Agregar a inicio»</span>.
            </p>
          )}
        </div>

        {/* Botón instalar (solo Android, donde hay diálogo nativo) */}
        {mode === 'android' && (
          <button
            onClick={handleInstall}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-lg bg-white text-[#008080] text-sm font-semibold hover:bg-white/90 transition-colors"
          >
            Instalar
          </button>
        )}

        {/* Cerrar */}
        <button
          onClick={dismiss}
          aria-label="Descartar"
          className="flex-shrink-0 p-1 rounded-md hover:bg-white/15 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
