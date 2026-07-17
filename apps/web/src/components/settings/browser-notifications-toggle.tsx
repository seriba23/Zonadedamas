'use client';

// ============================================================
// BrowserNotificationsToggle — control explícito para ACTIVAR las
// notificaciones push del navegador (Web Push).
//
// Contexto: `useEnsurePushSubscription()` (en el layout) solo suscribe si el
// permiso YA está concedido — nunca lo pide, porque los navegadores exigen
// una interacción del usuario. Sin un botón como este, el freelancer (y el
// admin) nunca reciben el diálogo de permiso → "no hay notificaciones del
// navegador". Este componente cierra ese hueco.
// ============================================================

import { useEffect, useState } from 'react';
import {
  pushSupported,
  pushPermission,
  registerServiceWorker,
  requestPushPermission,
  subscribePushOnServer,
  unsubscribePushOnServer,
} from '@/lib/push';

export function BrowserNotificationsToggle() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Estado inicial: permiso del navegador + si ya hay una suscripción activa.
  useEffect(() => {
    setPermission(pushPermission());
    if (!pushSupported()) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {
        /* sin SW listo todavía */
      }
    })();
  }, []);

  const supported = permission !== 'unsupported';
  const active = permission === 'granted' && subscribed;

  async function enable() {
    setBusy(true);
    try {
      await registerServiceWorker();
      const perm = await requestPushPermission();
      setPermission(perm);
      if (perm === 'granted') {
        const ok = await subscribePushOnServer();
        setSubscribed(ok);
      }
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await unsubscribePushOnServer();
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">Notificaciones del navegador</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Recibe avisos de citas y actividad aunque no tengas la app abierta.
          </p>
        </div>
        <div className="flex-shrink-0">
          {!supported ? (
            <span className="text-xs text-gray-400">No disponible</span>
          ) : permission === 'denied' ? (
            <span className="text-xs text-gray-400">Bloqueadas</span>
          ) : active ? (
            <button
              type="button"
              onClick={disable}
              disabled={busy}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#008080] text-white disabled:opacity-50"
            >
              {busy ? '…' : 'Activadas'}
            </button>
          ) : (
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {busy ? 'Activando…' : 'Activar'}
            </button>
          )}
        </div>
      </div>
      {permission === 'denied' && (
        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
          Las notificaciones están bloqueadas en este navegador. Actívalas desde el candado ⓘ de la barra de direcciones → Notificaciones → Permitir.
        </p>
      )}
    </div>
  );
}
