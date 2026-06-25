// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO: push.ts
// ─────────────────────────────────────────────────────────────────────────────
// Utilidades para las notificaciones push del navegador (Web Push API).
//
// Cómo funciona Web Push:
//   1. El navegador registra un Service Worker (/sw.js) que puede recibir
//      mensajes aunque la página no esté abierta.
//   2. El usuario concede permiso de notificaciones.
//   3. El navegador crea una "suscripción" con un endpoint único y dos llaves
//      de cifrado (p256dh y auth). Esto se envía al backend.
//   4. El backend envía notificaciones usando esas llaves a través del
//      protocolo VAPID (Voluntary Application Server Identification).
//
// NOTA SOBRE EL ERROR TS PREEXISTENTE:
//   Hay un error de TypeScript en este archivo que existía antes de agregar
//   estos comentarios. No se corrige aquí; solo se documenta su existencia.
// ─────────────────────────────────────────────────────────────────────────────

// Solo se ejecuta en el navegador (usa navigator, Notification, etc.).
'use client';

// `api` es el cliente HTTP del dashboard staff/admin.
import { api } from './api';

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN INTERNA: urlBase64ToUint8Array
// ─────────────────────────────────────────────────────────────────────────────
// El navegador necesita la VAPID public key como Uint8Array (array de bytes).
// El backend la provee como string en formato base64url (variante de base64
// que usa '-' y '_' en lugar de '+' y '/' para ser seguro en URLs).
//
// Parámetros:
//   base64String → la llave VAPID en formato base64url (string)
//
// Devuelve: Uint8Array con los bytes de la llave.
//
// Pasos:
//   1. El base64 estándar necesita que la longitud sea múltiplo de 4.
//      Añadimos '=' como relleno (padding) si falta.
//   2. Convertimos de base64url a base64 estándar:
//      reemplazamos '-' → '+' y '_' → '/'
//      .replace(/-/g, '+') → la 'g' en la regex /regex/g significa "global"
//      (reemplaza TODAS las ocurrencias, no solo la primera).
//   3. atob(base64) → decodifica base64 a string binario (un carácter por byte).
//   4. Creamos un Uint8Array del mismo tamaño y llenamos cada posición con
//      el código de carácter (.charCodeAt(i)) del string binario.
// Convierte la VAPID public key de base64url a Uint8Array (requerido por
// pushManager.subscribe).
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Calculamos el padding necesario: base64 trabaja en grupos de 4 caracteres.
  // (base64String.length % 4) → cuántos caracteres "sobran" en el último grupo
  // (4 - resto) % 4 → cuántos '=' necesitamos para completar el grupo
  // '='.repeat(n) → crea un string con n signos '='
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  // Concatenamos el padding y convertimos de base64url a base64 estándar.
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  // atob() decodifica un string base64 a un string binario (bytes como caracteres).
  const rawData = atob(base64);
  // Uint8Array: array de enteros sin signo de 8 bits (0-255), uno por byte.
  const outputArray = new Uint8Array(rawData.length);
  // Recorremos cada carácter del string binario y guardamos su código numérico.
  // ++i es equivalente a i++ aquí, pero se evalúa antes de usarlo.
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i); // código ASCII/Unicode del carácter i
  }
  return outputArray;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: pushSupported
// ─────────────────────────────────────────────────────────────────────────────
// Comprueba si el navegador actual soporta todas las APIs necesarias para
// las notificaciones push. Devuelve false en el servidor (SSR) y en
// navegadores que no soporten alguna de las tres APIs requeridas.
//
// Las tres condiciones unidas con && (AND lógico):
//   'serviceWorker' in navigator → el navegador tiene Service Workers
//   'PushManager' in window      → tiene la API Push
//   'Notification' in window     → tiene la API de notificaciones
// Las tres deben ser true para que las push funcionen.
export function pushSupported(): boolean {
  if (typeof window === 'undefined') return false; // seguridad en SSR
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: pushPermission
// ─────────────────────────────────────────────────────────────────────────────
// Devuelve el estado actual del permiso de notificaciones del navegador.
//
// Devuelve: NotificationPermission ('granted' | 'denied' | 'default')
//           o 'unsupported' si el navegador no soporta push.
//
// NotificationPermission es un tipo del navegador con tres valores posibles:
//   'granted'  → el usuario ya concedió permiso
//   'denied'   → el usuario bloqueó las notificaciones
//   'default'  → no se ha pedido permiso todavía (o lo cerró sin decidir)
// El | 'unsupported' añade un cuarto valor para nuestro caso especial.
export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission; // propiedad estática de la API del navegador
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: registerServiceWorker
// ─────────────────────────────────────────────────────────────────────────────
// Registra el archivo /sw.js como Service Worker en el navegador.
// El Service Worker es un script que corre en segundo plano y puede recibir
// notificaciones push incluso cuando la pestaña está cerrada.
//
// Devuelve: Promise<ServiceWorkerRegistration | null>
//   ServiceWorkerRegistration → objeto que representa el SW registrado
//   null → si falló el registro o el navegador no soporta SW
//
// El bloque try/catch captura errores del registro (p.ej. el archivo /sw.js
// no existe, error de seguridad de dominio, etc.) y devuelve null en lugar
// de lanzar una excepción.
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null; // sin soporte: no hacemos nada
  try {
    // navigator.serviceWorker.register() devuelve una promesa.
    // `scope: '/'` indica que el SW controla toda la aplicación.
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('[push] no se pudo registrar sw.js', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: requestPushPermission
// ─────────────────────────────────────────────────────────────────────────────
// Muestra el diálogo del navegador pidiendo permiso para enviar notificaciones.
// Si el navegador no soporta push, devuelve 'denied' directamente.
//
// Devuelve: Promise<NotificationPermission> → la decisión del usuario:
//   'granted'  → el usuario aceptó
//   'denied'   → el usuario rechazó (o ya tenía bloqueado)
//   'default'  → cerró el diálogo sin decidir
//
// IMPORTANTE: los navegadores modernos solo muestran este diálogo si hay
// una interacción previa del usuario (clic en un botón). No se puede pedir
// permiso automáticamente al cargar la página.
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!pushSupported()) return 'denied'; // sin soporte: devolvemos 'denied' como fallback
  return await Notification.requestPermission(); // muestra el diálogo al usuario
}

/**
 * Suscribe el browser al push manager con la VAPID publica del backend
 * y envia la suscripcion al endpoint del API. Devuelve true si quedo
 * suscrito (o si ya lo estaba), false en cualquier otro caso.
 */
// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: subscribePushOnServer
// ─────────────────────────────────────────────────────────────────────────────
// Suscribe el navegador al servicio de notificaciones push y registra la
// suscripción en el backend para que pueda enviar notificaciones a este
// dispositivo específico.
//
// Devuelve: Promise<boolean>
//   true  → la suscripción fue exitosa (o ya existía)
//   false → algo falló (no hay soporte, permiso denegado, error de red, etc.)
//
// Pasos detallados:
//   1. Verificar soporte y permiso.
//   2. Esperar a que el Service Worker esté listo.
//   3. Verificar si ya hay una suscripción activa (evita crearla de nuevo).
//   4. Si no hay suscripción: pedir la VAPID public key al backend.
//   5. Crear la suscripción con pushManager.subscribe().
//   6. Enviar los datos de suscripción al backend.
export async function subscribePushOnServer(): Promise<boolean> {
  if (!pushSupported()) return false;
  // Solo podemos suscribir si el usuario ya concedió permiso.
  if (Notification.permission !== 'granted') return false;

  // navigator.serviceWorker.ready → promesa que resuelve cuando el SW
  // está instalado y activado. Es diferente de register(): aquí esperamos
  // que el SW ya esté operativo.
  const reg = await navigator.serviceWorker.ready;

  // Si ya hay una suscripcion, reusarla.
  // getSubscription() devuelve la suscripción activa o null si no hay ninguna.
  // `let` porque podríamos reasignar `sub` si la creamos a continuación.
  let sub = await reg.pushManager.getSubscription();

  // Si no hay suscripción, necesitamos crear una.
  if (!sub) {
    // Paso 4: obtener la VAPID public key del backend.
    // NOTA: `res.data?.key` usa el operador ?. (optional chaining):
    //   si `res.data` es null o undefined, no intenta acceder a `.key`
    //   y devuelve undefined en su lugar (evita el error "Cannot read property of null").
    // ?? null → si undefined, usa null explícito.
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
      // El backend no tiene VAPID configurado (variables de entorno faltantes).
      console.warn('[push] backend sin VAPID configurado');
      return false;
    }

    // Paso 5: crear la suscripción push.
    // userVisibleOnly: true → obligatorio en Chrome; garantiza que todas las
    //   notificaciones serán visibles (no silenciosas).
    // applicationServerKey → la VAPID key convertida a bytes (Uint8Array).
    //   Esta llave verifica que solo nuestro servidor puede enviar notificaciones
    //   a esta suscripción (seguridad).
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    } catch (err) {
      // Puede fallar si el usuario bloqueó notificaciones justo en este momento,
      // o si el navegador tiene restricciones de seguridad.
      console.warn('[push] subscribe fallo', err);
      return false;
    }
  }

  // Paso 6: convertir la suscripción a JSON y enviarla al backend.
  // sub.toJSON() devuelve { endpoint, keys: { p256dh, auth } }.
  // NOTA SOBRE EL ERROR TS PREEXISTENTE:
  //   `as any` es un "cast" que le dice a TypeScript "confía en mí, sé el tipo
  //   que es". El error TS preexistente está relacionado con el tipo de `sub`
  //   en este punto del código (puede ser null según TS aunque en runtime
  //   siempre tiene valor). NO se corrige aquí.
  const json = sub.toJSON() as any;
  // Si la suscripción no tiene endpoint o llaves, está incompleta → no sirve.
  if (!json.endpoint || !json.keys) return false;

  // Enviamos los datos al backend para que los guarde en la base de datos.
  // El backend usará estos datos para enviar notificaciones al navegador.
  //   endpoint → URL única de este navegador en el servicio push del proveedor
  //   keys.p256dh → llave pública de cifrado (para que el backend cifre el mensaje)
  //   keys.auth   → secreto de autenticación
  //   userAgent → identificador del navegador/dispositivo (primeros 300 chars)
  //               .slice(0, 300) limita el string para no sobrecargar la BD.
  try {
    await api.post('/api/staff-notifications/push/subscribe', {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: navigator.userAgent.slice(0, 300),
    });
    return true; // todo bien: el dispositivo está suscrito
  } catch (err) {
    console.warn('[push] no se pudo registrar la suscripcion en el backend', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN: unsubscribePushOnServer
// ─────────────────────────────────────────────────────────────────────────────
// Cancela la suscripción push: notifica al backend para que borre el endpoint
// y luego cancela la suscripción en el propio navegador.
//
// Devuelve: Promise<void> (no hay valor de retorno).
//
// Si no hay suscripción activa, la función termina sin hacer nada.
//
// Los dos bloques try/catch independientes garantizan que si el primero falla
// (p.ej. no hay internet), el segundo igualmente se ejecuta para limpiar
// la suscripción del navegador. Usar `try {} catch {}` con el catch vacío
// significa "ignorar el error silenciosamente" (best-effort).
export async function unsubscribePushOnServer(): Promise<void> {
  if (!('serviceWorker' in navigator)) return; // sin soporte: no hay nada que cancelar
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return; // no había suscripción activa: nada que hacer

  // Notificamos al backend que borre este endpoint de su base de datos.
  // Solo enviamos el endpoint (URL) porque es el identificador único.
  try {
    await api.post('/api/staff-notifications/push/unsubscribe', {
      endpoint: sub.endpoint,
    });
  } catch {} // si falla (sin red, etc.), continuamos igualmente

  // Cancelamos la suscripción en el navegador (independientemente de si el
  // backend la borró o no).
  try {
    await sub.unsubscribe(); // revoca la suscripción en el push service del proveedor
  } catch {}
}
