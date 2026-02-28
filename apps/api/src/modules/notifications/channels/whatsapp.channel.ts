import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationPayload } from './channel.interface';

@Injectable()
export class WhatsAppChannel implements NotificationChannel {
  private readonly logger = new Logger(WhatsAppChannel.name);

  async send(
    payload: NotificationPayload,
  ): Promise<{ success: boolean; error?: string }> {
    // In development: console log only
    // TODO: Replace with WhatsApp Business API integration based on env vars
    try {
      this.logger.log(
        `\n====== WHATSAPP NOTIFICATION ======\n` +
          `To: ${payload.to}\n` +
          `Body:\n${payload.body}\n` +
          `===================================\n`,
      );
      return { success: true };
    } catch (error: any) {
      this.logger.error(`WhatsApp send failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
