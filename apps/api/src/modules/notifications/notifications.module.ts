import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationListenerService } from './notification-listener.service';
import { NotificationSenderService } from './notification-sender.service';
import { EmailChannel } from './channels/email.channel';
import { WhatsAppChannel } from './channels/whatsapp.channel';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationListenerService,
    NotificationSenderService,
    EmailChannel,
    WhatsAppChannel,
  ],
  exports: [NotificationsService, NotificationSenderService, EmailChannel],
})
export class NotificationsModule {}
