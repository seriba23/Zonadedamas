// Module = decorador de NestJS que agrupa y conecta las piezas de una
// funcionalidad (controladores, servicios, etc.) en una "caja" reutilizable.
import { Module } from '@nestjs/common';
// Importamos todas las piezas que componen el sistema de notificaciones:
// el controlador (endpoints), el servicio principal, el "oyente" de eventos,
// el "remitente" y los dos canales de envío.
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationListenerService } from './notification-listener.service';
import { NotificationSenderService } from './notification-sender.service';
import { EmailChannel } from './channels/email.channel';
import { WhatsAppChannel } from './channels/whatsapp.channel';

// @Module declara la composición de este módulo:
@Module({
  // controllers: clases que exponen endpoints HTTP de este módulo.
  controllers: [NotificationsController],
  // providers: servicios que NestJS instancia y puede inyectar DENTRO de este
  // módulo. Aquí registramos la lógica y ambos canales para que estén disponibles.
  providers: [
    NotificationsService,
    NotificationListenerService,
    NotificationSenderService,
    EmailChannel,
    WhatsAppChannel,
  ],
  // exports: lo que este módulo "presta" a OTROS módulos que lo importen. Así,
  // otras partes de la app pueden usar el servicio, el remitente y el canal email
  // (p. ej., para enviar notificaciones desde sus propios flujos).
  exports: [NotificationsService, NotificationSenderService, EmailChannel],
})
export class NotificationsModule {}
