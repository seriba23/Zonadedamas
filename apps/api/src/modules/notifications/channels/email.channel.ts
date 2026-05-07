import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { NotificationChannel, NotificationPayload } from './channel.interface';

@Injectable()
export class EmailChannel implements NotificationChannel {
  private readonly logger = new Logger(EmailChannel.name);
  private readonly resend: Resend | null;
  private readonly fromAddress: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@siliba.com';
    const fromName = process.env.RESEND_FROM_NAME || 'Siliba';
    this.fromAddress = `${fromName} <${fromEmail}>`;

    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY no configurada. Los emails se loguearan en consola en lugar de enviarse.',
      );
      this.resend = null;
    } else {
      this.resend = new Resend(apiKey);
    }
  }

  async send(
    payload: NotificationPayload,
  ): Promise<{ success: boolean; error?: string }> {
    // Sin API key configurada -> log en consola (modo dev / sandbox).
    if (!this.resend) {
      this.logger.log(
        `\n====== EMAIL (DRY-RUN) ======\nTo: ${payload.to}\nSubject: ${payload.subject}\nBody:\n${payload.body}\n=============================\n`,
      );
      return { success: true };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromAddress,
        to: [payload.to],
        subject: payload.subject || '(sin asunto)',
        // Soportamos plantillas HTML (con etiquetas) o texto plano.
        html: this.toHtml(payload.body),
        text: this.toPlainText(payload.body),
      });

      if (error) {
        this.logger.error(`Resend error: ${error.message}`);
        return { success: false, error: error.message };
      }

      this.logger.log(`Email enviado a ${payload.to} (id: ${data?.id})`);
      return { success: true };
    } catch (err: any) {
      this.logger.error(`Email send failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  private toHtml(body: string): string {
    // Si ya viene HTML (contiene una etiqueta), lo dejamos tal cual.
    if (/<[a-z][\s\S]*>/i.test(body)) return body;
    // Si es texto plano, lo envolvemos en HTML basico con saltos de linea.
    const escaped = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return `<!doctype html><html><body style="font-family: -apple-system, system-ui, sans-serif; color: #111; max-width: 560px; margin: 24px auto; padding: 0 16px;">${escaped}</body></html>`;
  }

  private toPlainText(body: string): string {
    // Strip etiquetas HTML para la version texto plano.
    return body.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  }
}
