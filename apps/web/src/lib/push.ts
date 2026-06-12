'use client';

import { api } from './api';

// Convierte la VAPID public key de base64url a Uint8Array (requerido por
// pushManager.subscribe).
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function pushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('[push] no se pudo registrar sw.js', err);
    return null;
  }
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!pushSupported()) return 'denied';
  return await Notification.requestPermission();
}

/**
 * Suscribe el browser al push manager con la VAPID publica del backend
 * y envia la suscripcion al endpoint del API. Devuelve true si quedo
 * suscrito (o si ya lo estaba), false en cualquier otro caso.
 */
export async function subscribePushOnServer(): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  const reg = await navigator.serviceWorker.ready;

  // Si ya hay una suscripcion, reusarla
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    let key: string | null = null;
    try {
      const res = await api.get<{ data: { key: string | null } }>(
        '/api/staff-notifications/vapid-public-key',
      );
      key = res.data?.key ?? null;
    } catch (err) {
      console.warn('[push] no se pudo obtener VAPID public key', err);
      return false;
    }
    if (!key) {
      console.warn('[push] backend sin VAPID configurado');
      return false;
    }

    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    } catch (err) {
      console.warn('[push] subscribe fallo', err);
      return false;
    }
  }

  const json = sub.toJSON() as any;
  if (!json.endpoint || !json.keys) return false;

  try {
    await api.post('/api/staff-notifications/push/subscribe', {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: navigator.userAgent.slice(0, 300),
    });
    return true;
  } catch (err) {
    console.warn('[push] no se pudo registrar la suscripcion en el backend', err);
    return false;
  }
}

export async function unsubscribePushOnServer(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  try {
    await api.post('/api/staff-notifications/push/unsubscribe', {
      endpoint: sub.endpoint,
    });
  } catch {}
  try {
    await sub.unsubscribe();
  } catch {}
}
