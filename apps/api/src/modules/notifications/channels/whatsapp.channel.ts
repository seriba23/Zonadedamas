// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
// De NestJS importamos:
//   - Injectable: decorador (etiqueta "@") que marca la clase como un servicio
//     que NestJS puede crear e inyectar donde se necesite.
//   - Logger: utilidad para escribir mensajes en la consola/registro del
//     servidor (info, advertencias, errores) de forma ordenada.
import { Injectable, Logger } from '@nestjs/common';
// Importamos los contratos (interfaces) que definen la forma de un mensaje y de
// un canal. Esta clase PROMETE cumplir el contrato NotificationChannel.
import { NotificationChannel, NotificationPayload } from './channel.interface';

@Injectable() // <- Marca la clase como servicio inyectable de NestJS.
// "implements NotificationChannel" = esta clase se COMPROMETE a cumplir ese
// contrato; por eso está obligada a tener el método send con la forma exacta.
export class WhatsAppChannel implements NotificationChannel {
  // Logger propio de esta clase. WhatsAppChannel.name = el texto "WhatsAppChannel",
  // que aparecerá como etiqueta delante de cada línea de log para saber de dónde
  // viene. "private readonly" = propiedad interna que no se reasigna.
  private readonly logger = new Logger(WhatsAppChannel.name);

  // send: envía (o simula enviar) un mensaje de WhatsApp.
  //   - Recibe: payload (los datos del mensaje: destinatario, cuerpo, etc.).
  //   - Devuelve: una Promise que resuelve a { success, error? }.
  async send(
    payload: NotificationPayload,
  ): Promise<{ success: boolean; error?: string }> {
    // En desarrollo: solo se imprime en consola (no se envía nada de verdad).
    // TODO: reemplazar por la integración real con la WhatsApp Business API,
    // leyendo credenciales desde variables de entorno.
    // "try" = intenta ejecutar este bloque; si algo falla, salta al "catch".
    try {
      // Escribimos el "mensaje" en el log con un marco visual para distinguirlo.
      // Los "\n" son saltos de línea, y "${payload.to}" / "${payload.body}"
      // insertan el destinatario y el cuerpo dentro del texto (interpolación).
      // El "+" concatena (une) los trozos de texto en uno solo.
      this.logger.log(
        `\n====== WHATSAPP NOTIFICATION ======\n` +
          `To: ${payload.to}\n` +
          `Body:\n${payload.body}\n` +
          `===================================\n`,
      );
      // Como en modo dev nunca falla, devolvemos éxito.
      return { success: true };
    } catch (error: any) {
      // Si algo lanzó un error, lo registramos. "error.message" es el texto
      // explicativo del fallo. ("error: any" = no tipamos el error, puede ser
      // cualquier cosa).
      this.logger.error(`WhatsApp send failed: ${error.message}`);
      // Devolvemos fracaso e incluimos el mensaje de error para quien llame.
      return { success: false, error: error.message };
    }
  }
}
