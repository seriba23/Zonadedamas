// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
// De NestJS: Injectable (servicio inyectable) y Logger (registro en consola).
import { Injectable, Logger } from '@nestjs/common';
// PrismaService: acceso a la base de datos (plantillas y logs).
import { PrismaService } from '../../prisma/prisma.service';
// Los dos canales concretos de envío y la interfaz común que ambos cumplen.
import { EmailChannel } from './channels/email.channel';
import { WhatsAppChannel } from './channels/whatsapp.channel';
import { NotificationChannel } from './channels/channel.interface';

/**
 * SendNotificationParams = la forma (contrato) de los datos que se pasan al
 * método sendForEvent. Describe TODO lo necesario para enviar una notificación
 * de un evento concreto.
 */
export interface SendNotificationParams {
  tenantId: string; // negocio dueño del envío
  eventName: string; // nombre del evento (ej. "appointment.created")
  // Email del destinatario. "?" = opcional; "| null" = también puede ser null.
  recipientEmail?: string | null;
  // Teléfono del destinatario (para WhatsApp). Opcional y puede ser null.
  recipientPhone?: string | null;
  // Variables para rellenar la plantilla (clave -> valor, ambos texto).
  variables: Record<string, string>;
}

@Injectable() // <- Servicio inyectable de NestJS.
export class NotificationSenderService {
  // Logger etiquetado con el nombre de esta clase.
  private readonly logger = new Logger(NotificationSenderService.name);
  // channelMap = un "diccionario" que asocia el tipo de plantilla (texto) con su
  // canal correspondiente. Así, dado "EMAIL" obtenemos el EmailChannel, etc.
  private readonly channelMap: Record<string, NotificationChannel>;

  constructor(
    // NestJS inyecta Prisma y los dos canales.
    private readonly prisma: PrismaService,
    private readonly emailChannel: EmailChannel,
    private readonly whatsAppChannel: WhatsAppChannel,
  ) {
    // Construimos el mapa: la clave "EMAIL" apunta al canal de email y la clave
    // "WHATSAPP" al de WhatsApp. Esto permite elegir canal por su nombre sin
    // usar un montón de "if".
    this.channelMap = {
      EMAIL: this.emailChannel,
      WHATSAPP: this.whatsAppChannel,
    };
  }

  // renderTemplate: rellena una plantilla sustituyendo sus marcadores {{clave}}
  // por los valores reales.
  //   - Recibe: la plantilla (texto con marcadores) y las variables.
  //   - Devuelve: el texto final ya rellenado.
  renderTemplate(
    template: string,
    variables: Record<string, string>,
  ): string {
    // replace con una expresión regular y una FUNCIÓN de reemplazo.
    // El patrón /\{\{(\w+)\}\}/g busca "{{algo}}":
    //   - \{\{ y \}\} = las llaves dobles literales (escapadas).
    //   - (\w+) = uno o más caracteres de "palabra" (letras/números/_), y los
    //     PARÉNTESIS los capturan como grupo, que llega a la función como "key".
    //   - 'g' (global) = reemplaza TODAS las apariciones.
    // Para cada coincidencia, la función decide con qué reemplazar:
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      // Si existe un valor para esa clave (no es undefined), lo usamos; si no,
      // dejamos el marcador original (match) tal cual, sin romper el texto.
      // "!==" compara con desigualdad estricta (distinto valor o tipo).
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  // sendForEvent: el método principal. Para un evento dado, busca las plantillas
  // activas, las rellena, las envía por su canal y registra el resultado en logs.
  //   - Devuelve Promise<void>: no retorna datos, solo realiza el trabajo.
  async sendForEvent(params: SendNotificationParams): Promise<void> {
    // Desestructuramos los parámetros en variables sueltas para usarlos cómodo.
    const {
      tenantId,
      eventName,
      recipientEmail,
      recipientPhone,
      variables,
    } = params;

    // Buscamos TODAS las plantillas de este negocio para este evento que estén
    // ACTIVAS y cuyo tipo sea EMAIL o WHATSAPP. El operador Prisma "in" significa
    // "que el campo esté DENTRO de esta lista de valores".
    const templates = await this.prisma.notificationTemplate.findMany({
      where: {
        tenantId,
        eventTrigger: eventName,
        isActive: true,
        type: { in: ['EMAIL', 'WHATSAPP'] },
      },
    });

    // Si no hay ninguna plantilla (length === 0 = lista vacía), no hay nada que
    // enviar: dejamos un mensaje de depuración y salimos.
    if (templates.length === 0) {
      this.logger.debug(
        `No active templates for event "${eventName}" in tenant ${tenantId}`,
      );
      return;
    }

    // RECORREMOS cada plantilla encontrada (puede haber una de email y otra de
    // WhatsApp para el mismo evento). El "for...of" pasa por cada "template".
    for (const template of templates) {
      // Elegimos el canal según el tipo de la plantilla (busca en el mapa).
      const channel = this.channelMap[template.type];
      // Si no hay canal para ese tipo (channel es undefined -> "!channel" es
      // true), avisamos y "continue" salta a la siguiente plantilla del bucle.
      if (!channel) {
        this.logger.warn(`No channel handler for type: ${template.type}`);
        continue;
      }

      // Decidimos el destinatario según el canal. Empezamos en null.
      let recipient: string | null = null;
      if (template.type === 'EMAIL') {
        // Para email usamos el correo; si viniera vacío, el "||" deja null.
        recipient = recipientEmail || null;
      } else if (template.type === 'WHATSAPP') {
        // Para WhatsApp usamos el teléfono.
        recipient = recipientPhone || null;
      }

      // Si no hay destinatario para ese canal, no podemos enviar: registramos y
      // saltamos a la siguiente plantilla. El ternario solo elige la palabra
      // ("email"/"phone") para que el mensaje de log sea más claro.
      if (!recipient) {
        this.logger.debug(
          `No recipient ${template.type === 'EMAIL' ? 'email' : 'phone'} for template ${template.id}, skipping`,
        );
        continue;
      }

      // Rellenamos el cuerpo de la plantilla con las variables (reemplaza {{..}}).
      const renderedBody = this.renderTemplate(
        template.bodyTemplate,
        variables,
      );
      // El asunto solo existe en emails. Con el ternario: si la plantilla TIENE
      // subject, lo rellenamos también; si no, dejamos undefined (sin asunto).
      const renderedSubject = template.subject
        ? this.renderTemplate(template.subject, variables)
        : undefined;

      // Intentamos enviar. "try" protege ante errores del canal.
      try {
        // Enviamos por el canal elegido y guardamos el resultado { success, error? }.
        const result = await channel.send({
          to: recipient,
          subject: renderedSubject,
          body: renderedBody,
        });

        // Guardamos un registro (log) del envío para tener historial. Varios
        // campos usan ternarios "=== 'EMAIL' ? ... : null" para llenar SOLO el
        // campo del canal usado (correo en email, teléfono en WhatsApp).
        await this.prisma.notificationLog.create({
          data: {
            tenantId,
            templateId: template.id,
            channel: template.type,
            eventName,
            recipientEmail:
              template.type === 'EMAIL' ? recipient : null,
            recipientPhone:
              template.type === 'WHATSAPP' ? recipient : null,
            subject: renderedSubject,
            body: renderedBody,
            // Estado según el resultado: 'SENT' si salió bien, 'FAILED' si no.
            status: result.success ? 'SENT' : 'FAILED',
            error: result.error, // mensaje de error si lo hubo (undefined si no)
            // sentAt: la fecha de envío SOLO si tuvo éxito; si falló, null.
            sentAt: result.success ? new Date() : null,
            metadata: { variables }, // guardamos las variables usadas como JSON
          },
        });
      } catch (error: any) {
        // Si el envío lanzó una excepción "dura", la registramos en el log...
        this.logger.error(
          `Failed to send ${template.type} notification for ${eventName}: ${error.message}`,
        );
        // ...y también dejamos constancia en la base de datos como FAILED.
        await this.prisma.notificationLog.create({
          data: {
            tenantId,
            templateId: template.id,
            channel: template.type,
            eventName,
            recipientEmail:
              template.type === 'EMAIL' ? recipient : null,
            recipientPhone:
              template.type === 'WHATSAPP' ? recipient : null,
            subject: renderedSubject,
            body: renderedBody,
            status: 'FAILED',
            error: error.message,
          },
        });
      }
    }
  }
}
