import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailChannel } from './channels/email.channel';
import { WhatsAppChannel } from './channels/whatsapp.channel';
import { NotificationChannel } from './channels/channel.interface';

export interface SendNotificationParams {
  tenantId: string;
  eventName: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  variables: Record<string, string>;
}

@Injectable()
export class NotificationSenderService {
  private readonly logger = new Logger(NotificationSenderService.name);
  private readonly channelMap: Record<string, NotificationChannel>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailChannel: EmailChannel,
    private readonly whatsAppChannel: WhatsAppChannel,
  ) {
    this.channelMap = {
      EMAIL: this.emailChannel,
      WHATSAPP: this.whatsAppChannel,
    };
  }

  renderTemplate(
    template: string,
    variables: Record<string, string>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  async sendForEvent(params: SendNotificationParams): Promise<void> {
    const {
      tenantId,
      eventName,
      recipientEmail,
      recipientPhone,
      variables,
    } = params;

    const templates = await this.prisma.notificationTemplate.findMany({
      where: {
        tenantId,
        eventTrigger: eventName,
        isActive: true,
        type: { in: ['EMAIL', 'WHATSAPP'] },
      },
    });

    if (templates.length === 0) {
      this.logger.debug(
        `No active templates for event "${eventName}" in tenant ${tenantId}`,
      );
      return;
    }

    for (const template of templates) {
      const channel = this.channelMap[template.type];
      if (!channel) {
        this.logger.warn(`No channel handler for type: ${template.type}`);
        continue;
      }

      let recipient: string | null = null;
      if (template.type === 'EMAIL') {
        recipient = recipientEmail || null;
      } else if (template.type === 'WHATSAPP') {
        recipient = recipientPhone || null;
      }

      if (!recipient) {
        this.logger.debug(
          `No recipient ${template.type === 'EMAIL' ? 'email' : 'phone'} for template ${template.id}, skipping`,
        );
        continue;
      }

      const renderedBody = this.renderTemplate(
        template.bodyTemplate,
        variables,
      );
      const renderedSubject = template.subject
        ? this.renderTemplate(template.subject, variables)
        : undefined;

      try {
        const result = await channel.send({
          to: recipient,
          subject: renderedSubject,
          body: renderedBody,
        });

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
            status: result.success ? 'SENT' : 'FAILED',
            error: result.error,
            sentAt: result.success ? new Date() : null,
            metadata: { variables },
          },
        });
      } catch (error: any) {
        this.logger.error(
          `Failed to send ${template.type} notification for ${eventName}: ${error.message}`,
        );
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
