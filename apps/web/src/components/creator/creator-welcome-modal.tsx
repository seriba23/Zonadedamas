// ─────────────────────────────────────────────────────────────────────────────
// CreatorWelcomeModal — modal DORADO de bienvenida al programa de Creadores.
//
// Se muestra cuando el super-admin aprueba al usuario como creador. Explica cómo
// funcionan las comisiones y ofrece un botón para entrar al portal de creadores
// "ya logueado" (SSO): usa la sesión de Siliba activa para emitir el token de
// creador, sin pedir usuario ni contraseña otra vez.
//
// El NEGRO es intencional: es la identidad distintiva del programa de creadores
// (misma que la sección "Creadores de contenido" del menú), para que no se
// confunda con la paleta teal del resto de la app.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
// SSO: cambia la sesión de Siliba por un token de creador.
import { creatorLoginFromSession } from '@/lib/creator-auth';

interface CreatorWelcomeModalProps {
  // Nombre para el saludo (opcional). Si no llega, saludo genérico.
  firstName?: string;
  // Qué hacer al cerrar sin entrar ("Ahora no"). Por defecto, volver atrás.
  onDismiss?: () => void;
}

export function CreatorWelcomeModal({ firstName, onDismiss }: CreatorWelcomeModalProps) {
  const router = useRouter();
  // busy: mientras hacemos el SSO (deshabilita botones y muestra spinner).
  const [busy, setBusy] = useState(false);
  // error: mensaje si el SSO falla (p. ej. aún pendiente de aprobación).
  const [error, setError] = useState<string | null>(null);

  // handleEnter: hace el SSO y, si todo va bien, entra al dashboard del portal.
  async function handleEnter() {
    setBusy(true);
    setError(null);
    try {
      await creatorLoginFromSession();
      router.push('/creator/dashboard');
    } catch (err: any) {
      setError(err?.message || 'No pudimos abrir tu portal de reclutamiento. Intenta de nuevo.');
      setBusy(false);
    }
  }

  // handleDismiss: "Ahora no" — cierra el modal (o vuelve atrás por defecto).
  function handleDismiss() {
    if (onDismiss) onDismiss();
    else router.back();
  }

  return (
    // Overlay semitransparente centrado (mismo patrón que los popups del proyecto).
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* ── Cabecera negra con icono ── */}
        <div className="relative bg-gradient-to-br from-gray-800 via-gray-900 to-black px-6 py-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/20">
            {/* Estrella/insignia */}
            <svg className="h-9 w-9 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M11.48 3.5a.6.6 0 011.04 0l2.34 4.05a.6.6 0 00.42.29l4.6.86a.6.6 0 01.32 1l-3.2 3.38a.6.6 0 00-.16.5l.6 4.63a.6.6 0 01-.85.62l-4.2-1.9a.6.6 0 00-.5 0l-4.2 1.9a.6.6 0 01-.85-.62l.6-4.63a.6.6 0 00-.16-.5L4.2 9.7a.6.6 0 01.32-1l4.6-.86a.6.6 0 00.42-.29L11.48 3.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">
            {firstName ? `¡Felicidades, ${firstName}!` : '¡Felicidades!'}
          </h2>
          <p className="mt-1 text-sm font-medium text-white/90">
            Ya eres parte de <span className="font-bold">Reclutadores Siliba</span>
          </p>
        </div>

        {/* ── Cuerpo: cómo funcionan las comisiones ── */}
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600">
            Tu solicitud fue aprobada. Ahora tienes un código único para invitar
            negocios y profesionales, y ganar comisiones recurrentes. Así funciona:
          </p>

          <div className="mt-4 space-y-3">
            {/* Paso 1 — descuento inicial al referido */}
            <div className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">1</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">Comparte tu código</p>
                <p className="text-xs text-gray-600">
                  Quien lo use recibe descuento sus primeros 2 meses
                  (negocios −$50, profesionales independientes −$25).
                </p>
              </div>
            </div>

            {/* Paso 2 — comisión recurrente desde el mes 3 */}
            <div className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">2</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">Gana cada mes</p>
                <p className="text-xs text-gray-600">
                  A partir del mes 3, mientras el referido siga activo, cobras
                  <span className="font-semibold text-gray-900"> $50/mes por cada negocio</span> y
                  <span className="font-semibold text-gray-900"> $25/mes por cada profesional</span>.
                </p>
              </div>
            </div>

            {/* Paso 3 — cobro por Stripe */}
            <div className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">3</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">Cobra directo</p>
                <p className="text-xs text-gray-600">
                  Conecta tu cuenta de cobros en el portal y recibe tus comisiones
                  automáticamente cada mes.
                </p>
              </div>
            </div>
          </div>

          {/* Error del SSO, si lo hay */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* ── Acciones ── */}
          <button
            onClick={handleEnter}
            disabled={busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-black disabled:opacity-60"
          >
            {busy && (
              <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {busy ? 'Abriendo tu portal...' : 'Entrar a mi portal de reclutamiento'}
          </button>
          <button
            onClick={handleDismiss}
            disabled={busy}
            className="mt-2 w-full rounded-xl py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
