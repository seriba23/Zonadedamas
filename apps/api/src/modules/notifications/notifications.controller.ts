// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
// De NestJS, los decoradores y utilidades para construir endpoints:
//   - Controller: marca la clase como grupo de endpoints.
//   - Get/Put/Post: marcan métodos que responden a esos verbos HTTP.
//   - Param: lee un trozo de la URL (ej. el :id).
//   - Query: lee parámetros de la query string (ej. ?type=EMAIL).
//   - Body: lee el JSON enviado en el cuerpo de la petición.
//   - UseGuards: aplica "guardias" (controles de acceso) al controlador.
//   - BadRequestException: error listo para responder HTTP 400.
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
// El servicio con la lógica de negocio (consultar/actualizar plantillas y logs).
import { NotificationsService } from './notifications.service';
// Los DTOs (moldes de datos) para validar entradas.
import { UpdateTemplateDto } from './dto/update-template.dto';
import { FilterTemplatesDto } from './dto/filter-templates.dto';
import { FilterLogsDto } from './dto/filter-logs.dto';
// El canal de email, usado en el endpoint de prueba (test-email).
import { EmailChannel } from './channels/email.channel';
// Guardias de seguridad:
//   - JwtAuthGuard: exige un token JWT válido (usuario autenticado).
//   - PermissionGuard: exige que el usuario tenga cierto permiso.
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
// RequirePermissions: decorador que indica QUÉ permiso pide cada endpoint.
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
// Decoradores "parámetro" que extraen datos del usuario logueado:
//   - CurrentTenant: el id del negocio (tenant) del token.
//   - CurrentUser: el objeto del usuario autenticado.
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// @Controller('notifications') => todas las rutas empiezan en /api/notifications.
@Controller('notifications')
// @UseGuards aplica AMBAS guardias a TODOS los endpoints de esta clase: primero
// se exige estar autenticado (JwtAuthGuard) y luego tener permiso (PermissionGuard).
@UseGuards(JwtAuthGuard, PermissionGuard)
// @RequirePermissions exige el permiso 'notifications.manage' para usar cualquier
// endpoint de este controlador (formato "modulo.accion").
@RequirePermissions('notifications.manage')
export class NotificationsController {
  // Inyección de dependencias: NestJS nos pasa el servicio y el canal email,
  // guardados como propiedades de solo lectura para usarlos en los métodos.
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly emailChannel: EmailChannel,
  ) {}

  // ── POST /api/notifications/test-email ───────────────────────────────────
  // Envía un correo de prueba para verificar que Resend está bien configurado.
  @Post('test-email')
  async testEmail(
    // @Body lee el JSON. Todos los campos son opcionales (llevan "?").
    @Body() body: { to?: string; subject?: string; body?: string },
  ) {
    // "!body?.to" se lee "si NO viene el destinatario". El "?." evita romper si
    // body llegara undefined. Sin destinatario no se puede enviar -> error 400.
    if (!body?.to) {
      throw new BadRequestException('Falta el campo "to" (destinatario).');
    }
    // Llamamos al canal de email. Los "||" ponen textos por defecto si el cliente
    // no envió asunto o cuerpo.
    const result = await this.emailChannel.send({
      to: body.to,
      subject: body.subject || 'Prueba Resend - Siliba',
      body:
        body.body ||
        'Si recibes este correo, Resend esta correctamente configurado en el VPS.',
    });
    // Devolvemos el resultado del envío en el formato estándar { data: ... }.
    return { data: result };
  }

  // ── GET /api/notifications/templates ─────────────────────────────────────
  // Lista las plantillas del negocio, con filtros opcionales.
  @Get('templates')
  async findAllTemplates(
    // @CurrentTenant() inyecta el id del negocio sacado del token.
    @CurrentTenant() tenantId: string,
    // @Query() recoge los filtros (eventTrigger, type) de la query string.
    @Query() filters: FilterTemplatesDto,
  ) {
    // Delegamos en el servicio y devolvemos lo que él retorne.
    return this.notificationsService.findAllTemplates(tenantId, filters);
  }

  // ── GET /api/notifications/templates/:id ─────────────────────────────────
  // Devuelve UNA plantilla por su id (dentro del negocio actual).
  @Get('templates/:id')
  async findOneTemplate(
    @CurrentTenant() tenantId: string,
    // @Param('id') toma el valor de la posición :id en la URL.
    @Param('id') id: string,
  ) {
    return this.notificationsService.findOneTemplate(id, tenantId);
  }

  // ── PUT /api/notifications/templates/:id ─────────────────────────────────
  // Actualiza (edita) una plantilla.
  @Put('templates/:id')
  async updateTemplate(
    @CurrentTenant() tenantId: string,
    // @CurrentUser() inyecta el usuario logueado; lo usamos para la auditoría.
    @CurrentUser() user: any,
    @Param('id') id: string,
    // @Body() trae los cambios validados por UpdateTemplateDto.
    @Body() dto: UpdateTemplateDto,
  ) {
    // Pasamos también user.userId para registrar QUIÉN hizo el cambio.
    return this.notificationsService.updateTemplate(
      id,
      dto,
      tenantId,
      user.userId,
    );
  }

  // ── GET /api/notifications/templates/:id/preview ─────────────────────────
  // Devuelve una "vista previa": la plantilla ya rellenada con datos de EJEMPLO,
  // para que el admin vea cómo quedaría el mensaje real.
  @Get('templates/:id/preview')
  async previewTemplate(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    // Pedimos la plantilla. Desestructuramos { data: template } para sacar el
    // objeto plantilla del envoltorio { data } que devuelve el servicio.
    const { data: template } =
      await this.notificationsService.findOneTemplate(id, tenantId);
    // Obtenemos variables de ejemplo apropiadas para ESTE tipo de evento.
    const variables =
      this.notificationsService.getSampleVariables(template.eventTrigger);

    // "let" (no "const") porque vamos a reasignar estas variables al reemplazar.
    // Partimos del cuerpo de la plantilla y del asunto ('' si no tiene, vía "||").
    let renderedBody = template.bodyTemplate;
    let renderedSubject = template.subject || '';
    // RECORRIDO de variables: Object.entries(variables) convierte el objeto
    // { clientName: 'Maria', ... } en una lista de pares [clave, valor]. El bucle
    // "for...of" pasa por cada par, desestructurándolo en [key, value].
    for (const [key, value] of Object.entries(variables)) {
      // Construimos una expresión regular que busca el marcador "{{clave}}".
      // Las "\\{" escapan las llaves (en regex "{" es especial); la bandera 'g'
      // (global) hace que reemplace TODAS las apariciones, no solo la primera.
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      // Sustituimos cada "{{clave}}" por su valor real, tanto en cuerpo como en
      // asunto. Tras el bucle, ya no quedan marcadores sin reemplazar.
      renderedBody = renderedBody.replace(regex, value);
      renderedSubject = renderedSubject.replace(regex, value);
    }

    // Devolvemos el asunto y cuerpo ya rellenados, más las variables usadas.
    return {
      data: {
        subject: renderedSubject,
        body: renderedBody,
        variables,
      },
    };
  }

  // ── GET /api/notifications/logs ──────────────────────────────────────────
  // Lista el historial paginado de notificaciones enviadas, con filtros.
  @Get('logs')
  async findAllLogs(
    @CurrentTenant() tenantId: string,
    @Query() filters: FilterLogsDto,
  ) {
    return this.notificationsService.findAllLogs(tenantId, filters);
  }
}
