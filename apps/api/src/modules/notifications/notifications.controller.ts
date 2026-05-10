import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { FilterTemplatesDto } from './dto/filter-templates.dto';
import { FilterLogsDto } from './dto/filter-logs.dto';
import { EmailChannel } from './channels/email.channel';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermissions('notifications.manage')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly emailChannel: EmailChannel,
  ) {}

  @Post('test-email')
  async testEmail(
    @Body() body: { to?: string; subject?: string; body?: string },
  ) {
    if (!body?.to) {
      throw new BadRequestException('Falta el campo "to" (destinatario).');
    }
    const result = await this.emailChannel.send({
      to: body.to,
      subject: body.subject || 'Prueba Resend - Siliba',
      body:
        body.body ||
        'Si recibes este correo, Resend esta correctamente configurado en el VPS.',
    });
    return { data: result };
  }

  @Get('templates')
  async findAllTemplates(
    @CurrentTenant() tenantId: string,
    @Query() filters: FilterTemplatesDto,
  ) {
    return this.notificationsService.findAllTemplates(tenantId, filters);
  }

  @Get('templates/:id')
  async findOneTemplate(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.notificationsService.findOneTemplate(id, tenantId);
  }

  @Put('templates/:id')
  async updateTemplate(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.notificationsService.updateTemplate(
      id,
      dto,
      tenantId,
      user.userId,
    );
  }

  @Get('templates/:id/preview')
  async previewTemplate(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const { data: template } =
      await this.notificationsService.findOneTemplate(id, tenantId);
    const variables =
      this.notificationsService.getSampleVariables(template.eventTrigger);

    let renderedBody = template.bodyTemplate;
    let renderedSubject = template.subject || '';
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      renderedBody = renderedBody.replace(regex, value);
      renderedSubject = renderedSubject.replace(regex, value);
    }

    return {
      data: {
        subject: renderedSubject,
        body: renderedBody,
        variables,
      },
    };
  }

  @Get('logs')
  async findAllLogs(
    @CurrentTenant() tenantId: string,
    @Query() filters: FilterLogsDto,
  ) {
    return this.notificationsService.findAllLogs(tenantId, filters);
  }
}
