import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  link?: string;
  tag?: string;
  notificationId?: string;
}

@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);
  private configured = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:soporte@siliba.com';

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY no configuradas. Web push deshabilitado.',
      );
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.configured = true;
    this.logger.log('Web push configurado con VAPID.');
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.configured) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subscriptions.length === 0) return;

    const serialized = JSON.stringify(payload);

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            serialized,
          );
          await this.prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { lastUsedAt: new Date() },
          });
        } catch (err: any) {
          const status = err?.statusCode;
          // 404 Gone / 410 Expired: la suscripción ya no es válida, eliminarla
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: sub.id } })
              .catch(() => undefined);
            return;
          }
          this.logger.warn(
            `Push failed (${status ?? 'no-status'}) para sub ${sub.id}: ${err?.message ?? err}`,
          );
        }
      }),
    );
  }
}
