'use client';

// ─────────────────────────────────────────────────────────────────────────────
// InstallAppContent: pantalla "Instalar app" dentro de Configuración. Acceso
// PERMANENTE para instalar la PWA (a diferencia del banner, que se descarta).
// Se adapta al dispositivo:
//   - Android/desktop con prompt disponible → botón "Instalar app" (diálogo nativo).
//   - iPhone/iPad → instructivo "Compartir → Agregar a inicio".
//   - Ya instalada → mensaje de confirmación.
//   - Desktop sin prompt disponible → instrucciones del menú del navegador.
// Instalar la app es además lo que habilita las notificaciones push en iPhone.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useInstallPwa } from '@/components/pwa/install-pwa-context';

function Benefit({ title, desc }: { title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-[#e0f2f1] text-[#008080] flex items-center justify-center">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </li>
  );
}

export function InstallAppContent() {
  const install = useInstallPwa();
  const [busy, setBusy] = useState(false);

  const isStandalone = install?.isStandalone ?? false;
  const installed = install?.installed ?? false;
  const isIos = install?.isIos ?? false;
  const canPrompt = install?.canPrompt ?? false;

  async function handleInstall() {
    if (!install) return;
    setBusy(true);
    try {
      await install.promptInstall();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <span className="flex-shrink-0 w-12 h-12 rounded-2xl bg-[#008080] text-white flex items-center justify-center text-xl font-extrabold">
          S
        </span>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Instalar la app</h2>
          <p className="text-xs text-gray-500">
            Agrega Siliba a tu dispositivo para un acceso más rápido y notificaciones.
          </p>
        </div>
      </div>

      {/* Beneficios */}
      <ul className="space-y-3 bg-white rounded-xl border border-gray-200 p-4">
        <Benefit
          title="Notificaciones en tu dispositivo"
          desc="Recibe avisos de citas, pagos y más aunque no tengas la app abierta."
        />
        <Benefit title="Acceso directo" desc="Un ícono en tu pantalla de inicio, como cualquier app." />
        <Benefit title="Pantalla completa" desc="Se abre sin la barra del navegador, más cómoda de usar." />
      </ul>

      {/* Acción según dispositivo/estado */}
      {isStandalone || installed ? (
        <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 p-4 text-teal-800">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">La app ya está instalada en este dispositivo. ✓</p>
        </div>
      ) : canPrompt ? (
        // Android / desktop Chromium: diálogo nativo.
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <button
            onClick={handleInstall}
            disabled={busy}
            className="w-full px-4 py-2.5 rounded-lg bg-[#008080] text-white text-sm font-semibold hover:bg-[#006666] disabled:opacity-50 transition-colors"
          >
            {busy ? 'Abriendo…' : 'Instalar app'}
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Se abrirá el diálogo de instalación de tu navegador.
          </p>
        </div>
      ) : isIos ? (
        // iPhone/iPad: instructivo manual (Apple no permite instalar por código).
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-sm font-medium text-gray-900">Para instalar en tu iPhone/iPad:</p>
          <ol className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#008080] text-white text-[11px] font-bold flex items-center justify-center">1</span>
              <span className="inline-flex items-center flex-wrap gap-1">
                Abre esta página en <b>Safari</b> y toca el botón
                <span className="inline-flex items-center font-semibold">
                  Compartir
                  <svg className="w-4 h-4 mx-0.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
                  </svg>
                </span>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#008080] text-white text-[11px] font-bold flex items-center justify-center">2</span>
              <span>Elige <b>«Agregar a inicio»</b> (Add to Home Screen).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#008080] text-white text-[11px] font-bold flex items-center justify-center">3</span>
              <span>Confirma con <b>«Agregar»</b>. Abre Siliba desde el nuevo ícono para activar las notificaciones.</span>
            </li>
          </ol>
        </div>
      ) : (
        // Desktop u otros navegadores sin prompt disponible.
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
          <p className="text-sm text-gray-700">
            Abre el menú de tu navegador (⋮ o el ícono de instalar en la barra de
            direcciones) y elige <b>«Instalar app»</b> o <b>«Agregar a pantalla de inicio»</b>.
          </p>
          <p className="text-xs text-gray-500">
            Si no ves la opción, quizá la app ya está instalada o tu navegador no lo permite.
          </p>
        </div>
      )}
    </div>
  );
}
