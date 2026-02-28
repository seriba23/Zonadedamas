import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationPayload } from './channel.interface';

@Injectable()
export class EmailChannel implements NotificationChannel {
  private readonly logger = new Logger(EmailChannel.name);

  async send(
    payload: NotificationPayload,
  ): Promise<{ success: boolean; error?: string }> {
    // In development: console log only
    // TODO: Replace with real provider (SendGrid, Resend, etc.) based on env var
    try {
      this.logger.log(
        `\n====== EMAIL NOTIFICATION ======\n` +
          `To: ${payload.to}\n` +
          `Subject: ${payload.subject}\n` +
          `Body:\n${payload.body}\n` +
          `================================\n`,
      );
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Email send failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
