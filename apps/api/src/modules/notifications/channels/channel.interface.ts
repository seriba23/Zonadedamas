// ─────────────────────────────────────────────────────────────────────────────
// CONTRATOS (interfaces) COMPARTIDOS POR TODOS LOS CANALES DE NOTIFICACIÓN
// ─────────────────────────────────────────────────────────────────────────────
// Una "interface" en TypeScript NO genera código: solo describe la FORMA que
// deben tener los objetos. Sirve como un "contrato" que las clases prometen
// cumplir. Aquí definimos dos contratos: el de los datos de un mensaje
// (NotificationPayload) y el de cualquier canal capaz de enviarlo
// (NotificationChannel). Así, EmailChannel y WhatsAppChannel comparten la misma
// "pinta" y se pueden intercambiar entre sí.

/**
 * NotificationPayload = los datos de UN mensaje a enviar, sea por el canal que
 * sea (email, WhatsApp, etc.). Es la "carga útil" (payload) que viaja al canal.
 */
export interface NotificationPayload {
  // Destinatario: a quién va el mensaje. Para email es un correo; para WhatsApp,
  // un teléfono. Es un texto obligatorio (no lleva "?").
  to: string;
  // Asunto del mensaje. El "?" lo marca como OPCIONAL: el email lo usa, pero
  // WhatsApp no tiene asunto, así que puede venir ausente (undefined).
  subject?: string;
  // Cuerpo/contenido del mensaje. Obligatorio (sin "?"): siempre hay algo que
  // decir. Puede ser texto plano o HTML (lo decide cada canal).
  body: string;
  // Metadatos extra opcionales. Record<string, any> = un objeto cuyas claves son
  // textos y cuyos valores pueden ser de cualquier tipo (any). Es una "bolsa"
  // flexible para datos adicionales que algún canal quiera adjuntar.
  metadata?: Record<string, any>;
}

/**
 * NotificationChannel = el contrato que DEBE cumplir cualquier canal de envío.
 * Obliga a tener un método "send" que reciba un payload y devuelva el resultado.
 * Gracias a esto, el servicio que envía no necesita saber si por dentro es email
 * o WhatsApp: solo llama a channel.send(...).
 */
export interface NotificationChannel {
  // send recibe el payload (los datos del mensaje) y devuelve una Promise (algo
  // que tarda y se espera con "await"). Cuando termina, resuelve a un objeto con:
  //   - success: true si se envió bien, false si falló.
  //   - error?: el mensaje de error (opcional, solo aparece si algo falló).
  send(
    payload: NotificationPayload,
  ): Promise<{ success: boolean; error?: string }>;
}
