// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos:
//   - Injectable: decorador (etiqueta "@") que marca esta clase como un
//     "servicio" que NestJS puede crear e inyectar en otras clases.
//   - Logger: utilidad para imprimir mensajes en la consola/registro del
//     servidor (info, advertencias, errores) de forma ordenada.
//   - OnModuleInit: "interfaz de ciclo de vida". Si una clase la implementa,
//     NestJS llamará automáticamente a su método onModuleInit() justo después
//     de crear el módulo. Útil para inicializar cosas al arrancar.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

// "web-push" es la librería que sabe enviar "notificaciones push web": esos
// avisos que aparecen en el navegador/teléfono aunque la pestaña esté cerrada.
// "* as webpush" significa "importa TODO el módulo y guárdalo bajo el nombre
// webpush", para luego llamar webpush.setVapidDetails(), webpush.sendNotification(), etc.
import * as webpush from 'web-push';

// PrismaService es nuestro "puente" hacia la base de datos. A través de
// this.prisma leemos/escribimos tablas como pushSubscription.
import { PrismaService } from '../../prisma/prisma.service';

// "interface" describe la FORMA (los campos) de un objeto, solo para que
// TypeScript valide tipos; no genera código. PushPayload es el contenido que
// viajará dentro de una notificación push.
export interface PushPayload {
  title: string;            // título grande de la notificación (obligatorio)
  body: string;             // texto del cuerpo de la notificación (obligatorio)
  link?: string;            // URL a abrir al pulsarla. El "?" = campo opcional.
  tag?: string;             // "etiqueta" para agrupar/reemplazar notificaciones.
  notificationId?: string;  // id de la notificación en BD (para referenciarla).
}

// @Injectable() marca la clase como servicio inyectable de NestJS.
// "implements OnModuleInit" promete que la clase tendrá el método onModuleInit().
@Injectable()
export class WebPushService implements OnModuleInit {
  // Logger propio de este servicio. Le pasamos el nombre de la clase para que
  // cada línea de log diga de dónde viene. "readonly" = no se reasigna.
  private readonly logger = new Logger(WebPushService.name);
  // Bandera (true/false) que recuerda si las claves VAPID se cargaron bien.
  // Empieza en false; si no está configurado, no intentaremos enviar push.
  private configured = false;

  // El constructor recibe el PrismaService que NestJS inyecta automáticamente.
  // "private readonly prisma" lo guarda como propiedad (this.prisma) de solo
  // lectura, para usarlo en los métodos de abajo.
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // onModuleInit(): NestJS lo llama UNA vez al arrancar este módulo. Aquí
  // configuramos la librería web-push con las claves VAPID.
  //
  // VAPID = "Voluntary Application Server Identification". Es un par de claves
  // (pública + privada) que identifican a NUESTRO servidor ante el navegador.
  // La pública la conoce el navegador del usuario; la privada la guarda el
  // servidor en secreto y firma con ella cada push para demostrar que es legítimo.
  // ───────────────────────────────────────────────────────────────────────────
  onModuleInit() {
    // process.env.X lee una "variable de entorno" (configuración secreta que
    // vive fuera del código, ej. en el archivo .env). Aquí leemos las claves.
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    // El "subject" es un contacto del dueño del servidor (mailto: o una URL).
    // "|| 'mailto:...'": si la variable no existe, usamos ese correo por defecto.
    const subject = process.env.VAPID_SUBJECT || 'mailto:soporte@siliba.com';

    // Si falta CUALQUIERA de las dos claves, no podemos enviar push. Avisamos
    // con una advertencia y salimos (return) sin configurar nada.
    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY no configuradas. Web push deshabilitado.',
      );
      return;
    }

    // Entregamos las claves a la librería web-push (queda lista para enviar).
    webpush.setVapidDetails(subject, publicKey, privateKey);
    // Marcamos que SÍ está configurado y dejamos constancia en el log.
    this.configured = true;
    this.logger.log('Web push configurado con VAPID.');
  }

  // Pequeño método público para que otros consulten si el push está listo.
  // Devuelve true/false según la bandera "configured".
  isConfigured(): boolean {
    return this.configured;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // sendToUser(): envía una notificación push a TODOS los dispositivos
  // (navegadores) que ese usuario haya registrado. Devuelve una "promesa"
  // (Promise<void>) porque hace operaciones que tardan (red + base de datos).
  // ───────────────────────────────────────────────────────────────────────────
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    // Si el servicio no está configurado, no hacemos nada y salimos.
    if (!this.configured) return;

    // Buscamos en la BD TODAS las suscripciones push de ese usuario. Cada
    // suscripción representa un navegador/dispositivo distinto donde aceptó push.
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    // Si el usuario no tiene ningún dispositivo registrado, no hay a quién
    // enviar: salimos. ".length === 0" = "la lista está vacía".
    if (subscriptions.length === 0) return;

    // El contenido de la notificación viaja como texto. JSON.stringify convierte
    // el objeto payload en una cadena de texto (ej. '{"title":"...","body":"..."}').
    const serialized = JSON.stringify(payload);

    // Promise.all(...) lanza varias tareas EN PARALELO y espera a que todas
    // terminen. Aquí, .map convierte cada suscripción en una promesa de envío.
    await Promise.all(
      // Para cada suscripción "sub" intentamos enviarle la notificación.
      subscriptions.map(async (sub) => {
        // "try" intenta el envío; si algo falla, saltamos al "catch" de abajo,
        // de modo que el fallo de UN dispositivo no rompe el envío al resto.
        try {
          // sendNotification recibe DOS cosas:
          //   1) el objeto "PushSubscription" del navegador: su endpoint (la URL
          //      del servicio push del navegador) y sus claves (p256dh y auth)
          //      que sirven para CIFRAR el mensaje y que solo ese navegador lo lea.
          //   2) el contenido ya serializado a texto.
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            serialized,
          );
          // Si el envío fue bien, anotamos en la BD la última vez que se usó
          // esta suscripción (útil para limpieza/diagnóstico). new Date() = ahora.
          await this.prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { lastUsedAt: new Date() },
          });
        } catch (err: any) {
          // Si hubo error, "err?.statusCode" lee el código HTTP del fallo.
          // El "?." (encadenamiento opcional) evita romper si "err" fuera null:
          // en ese caso devuelve undefined en lugar de lanzar otro error.
          const status = err?.statusCode;
          // 404 (Gone) / 410 (Expired): el navegador ya no acepta esa
          // suscripción (el usuario revocó el permiso o cambió de dispositivo).
          // En ese caso la BORRAMOS de la BD para no volver a intentar.
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: sub.id } })
              // .catch(() => undefined): si el borrado fallara (ej. ya no existe),
              // lo ignoramos silenciosamente devolviendo undefined.
              .catch(() => undefined);
            return; // terminamos con esta suscripción.
          }
          // Cualquier otro error (ej. red caída) solo se registra como aviso.
          // "status ?? 'no-status'": el "??" (fusión de nulos) usa 'no-status'
          // únicamente si status es null o undefined (no si fuera 0 o '').
          // "err?.message ?? err": usa el mensaje del error si existe; si no, el err crudo.
          this.logger.warn(
            `Push failed (${status ?? 'no-status'}) para sub ${sub.id}: ${err?.message ?? err}`,
          );
        }
      }),
    );
  }
}
