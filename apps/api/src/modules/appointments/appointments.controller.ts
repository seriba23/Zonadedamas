// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Decoradores y utilidades de NestJS para construir endpoints HTTP:
//   - Body: lee el cuerpo (JSON) de la petición.
//   - Controller: marca la clase como grupo de rutas.
//   - Delete/Get/Post/Put: marcan un método como endpoint de ese verbo HTTP.
//   - Param: lee un trozo variable de la URL (ej. el :id de /appointments/:id).
//   - Query: lee parámetros de la query string (ej. ?hoursAhead=36).
//   - UseGuards: aplica "guardias" (controles de seguridad) antes de entrar.
//   - UseInterceptors: aplica "interceptores" (aquí, para recibir archivos).
//   - UploadedFile: extrae el archivo subido del formulario multipart.
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
// FileInterceptor procesa la subida de UN archivo enviado en un formulario
// multipart/form-data (necesario para fotos y comprobantes de pago).
import { FileInterceptor } from '@nestjs/platform-express';
// El servicio con la lógica de negocio de citas.
import { AppointmentsService } from './appointments.service';
// DTOs (formas de los datos de entrada) para crear y actualizar citas.
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/create-appointment.dto';
// DTOs para reagendar y cancelar.
import { RescheduleDto, CancelDto } from './dto/reschedule.dto';
// DTO con los filtros del listado de citas.
import { FilterAppointmentsDto } from './dto/filter-appointments.dto';
import { ConfirmDepositDto } from './dto/confirm-deposit.dto';
import { SetStatusDto } from './dto/set-status.dto';
// Guardia que exige un token JWT válido (usuario autenticado del negocio).
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// Guardia que verifica que el usuario tenga el permiso requerido.
import { PermissionGuard } from '../../common/guards/permission.guard';
// Decorador para declarar QUÉ permiso exige cada endpoint (formato "modulo.accion").
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
// Decorador que extrae el tenantId (el negocio actual) desde el token JWT.
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
// Decorador que extrae el usuario autenticado (incluye su userId) desde el JWT.
import { CurrentUser } from '../../common/decorators/current-user.decorator';
// Servicio para guardar/borrar archivos en el almacenamiento (fotos, comprobantes).
import { UploadsService } from '../uploads/uploads.service';
// Puente directo a la base de datos (Prisma), usado en algunos endpoints de fotos.
import { PrismaService } from '../../prisma/prisma.service';

// @Controller('appointments') => todas las rutas de esta clase cuelgan de
// "/api/appointments" (el prefijo "/api" se añade globalmente en otra parte).
@Controller('appointments')
// @UseGuards aplica DOS guardias a TODOS los endpoints de la clase, en orden:
// primero JwtAuthGuard (¿hay sesión válida?) y luego PermissionGuard (¿tiene
// permiso?). Si cualquiera falla, la petición se rechaza antes de ejecutar nada.
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AppointmentsController {
  // INYECCIÓN DE DEPENDENCIAS: NestJS crea y pasa estas tres clases.
  // "private readonly" las guarda como propiedades de solo lectura (this.xxx).
  constructor(
    private readonly appointmentsService: AppointmentsService, // lógica de citas
    private readonly uploadsService: UploadsService,            // guardar/borrar archivos
    private readonly prisma: PrismaService,                     // acceso directo a la BD
  ) {}

  // ── GET /api/appointments ───────────────────────────────────────────────────
  // Lista paginada de citas del negocio, aplicando los filtros recibidos.
  @Get()
  // Exige el permiso "appointments.read" para poder leer citas.
  @RequirePermissions('appointments.read')
  async findAll(
    // @CurrentTenant() saca el ID del negocio del token; garantiza multi-tenant.
    @CurrentTenant() tenantId: string,
    // @Query() recoge TODOS los parámetros de la URL y los mete en el DTO de filtros.
    @Query() filters: FilterAppointmentsDto,
  ) {
    // Delegamos al servicio y devolvemos su resultado (lista + metadatos paginación).
    return this.appointmentsService.findAll(tenantId, filters);
  }

  // ── POST /api/appointments ──────────────────────────────────────────────────
  // Crea una cita nueva (con anti-doble-reserva y snapshots en el servicio).
  @Post()
  @RequirePermissions('appointments.create')
  async create(
    @CurrentTenant() tenantId: string,
    // @CurrentUser() trae el usuario autenticado; usamos su user.userId para
    // registrar QUIÉN creó la cita (auditoría). "any" = tipo flexible.
    @CurrentUser() user: any,
    // @Body() valida el JSON contra CreateAppointmentDto antes de llegar aquí.
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(dto, tenantId, user.userId);
  }

  // ── GET /api/appointments/:id ───────────────────────────────────────────────
  // Devuelve UNA cita con todo su detalle (cliente, items, pagos, historial...).
  @Get(':id')
  @RequirePermissions('appointments.read')
  async findOne(
    @CurrentTenant() tenantId: string,
    // @Param('id') toma el valor de la posición :id de la URL.
    @Param('id') id: string,
  ) {
    return this.appointmentsService.findOne(id, tenantId);
  }

  // ── PUT /api/appointments/:id ───────────────────────────────────────────────
  // Actualiza solo las notas (visibles e internas) de la cita.
  @Put(':id')
  @RequirePermissions('appointments.update')
  async update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(id, dto, tenantId, user.userId);
  }

  // ── POST /api/appointments/:id/reschedule ───────────────────────────────────
  // Mueve la cita a otro horario (y, opcionalmente, a otro empleado).
  @Post(':id/reschedule')
  @RequirePermissions('appointments.reschedule')
  async reschedule(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RescheduleDto,
  ) {
    return this.appointmentsService.reschedule(id, dto, tenantId, user.userId);
  }

  // ── POST /api/appointments/:id/cancel ───────────────────────────────────────
  // Cancela la cita (con motivo opcional). Devuelve puntos/cupón si aplica.
  @Post(':id/cancel')
  @RequirePermissions('appointments.cancel')
  async cancel(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CancelDto,
  ) {
    return this.appointmentsService.cancel(id, dto, tenantId, user.userId);
  }

  // ── POST /api/appointments/:id/confirm ──────────────────────────────────────
  // Marca una cita PENDING/RESCHEDULED como CONFIRMED (el negocio la confirma).
  @Post(':id/confirm')
  @RequirePermissions('appointments.update')
  async confirm(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.confirm(id, tenantId, user.userId);
  }

  // ── POST /api/appointments/:id/set-status ───────────────────────────────────
  // Cambio LIBRE entre estados activos (PENDING/CONFIRMED/IN_PROGRESS), adelante
  // o atras, para corregir errores humanos. Sin efectos financieros.
  @Post(':id/set-status')
  @RequirePermissions('appointments.update')
  async setStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: SetStatusDto,
  ) {
    return this.appointmentsService.setStatus(id, tenantId, dto.status, user.userId);
  }

  // ── POST /api/appointments/:id/reopen ───────────────────────────────────────
  // Reabre una cita cerrada (COMPLETED/CANCELLED/NO_SHOW) volviendola a CONFIRMED
  // para corregir un cierre equivocado. NO revierte efectos financieros.
  @Post(':id/reopen')
  @RequirePermissions('appointments.update')
  async reopen(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.reopen(id, tenantId, user.userId);
  }

  // ── POST /api/appointments/:id/confirm-deposit ──────────────────────────────
  // El negocio confirma el anticipo: aceptar (confirma la cita), solicitar el
  // resto (registra parcial, sigue pendiente) u omitir (exonera y confirma).
  @Post(':id/confirm-deposit')
  @RequirePermissions('appointments.update')
  async confirmDeposit(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ConfirmDepositDto,
  ) {
    return this.appointmentsService.confirmDeposit(id, tenantId, dto, user.userId);
  }

  // ── POST /api/appointments/:id/complete ─────────────────────────────────────
  // Marca la cita como COMPLETED (cierre): valida fotos según consentimiento,
  // entrega productos, otorga puntos y registra notificación de reseña.
  @Post(':id/complete')
  @RequirePermissions('appointments.complete')
  async complete(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.complete(id, tenantId, user.userId);
  }

  // ── POST /api/appointments/from-pos ─────────────────────────────────────────
  // Crea una cita YA completada a partir de una venta del Punto de Venta (POS).
  // No valida solapamientos (excepción del POS) y calcula el horario hacia atrás.
  @Post('from-pos')
  @RequirePermissions('appointments.create')
  async createFromPos(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    // El cuerpo trae cliente, sucursal, las asignaciones servicio→empleado y
    // notas opcionales. Aquí el tipo se declara "en línea" (no un DTO aparte).
    @Body() body: { clientId: string; locationId: string; serviceAssignments: Array<{ serviceId: string; employeeId: string }>; notes?: string },
  ) {
    return this.appointmentsService.createFromPos(tenantId, body, user.userId);
  }

  // ── POST /api/appointments/:id/photo-consent ────────────────────────────────
  // Guarda si el cliente acepta (true) o rechaza (false) fotos del resultado.
  // Paso del "wizard de cierre" previo a completar la cita.
  @Post(':id/photo-consent')
  @RequirePermissions('appointments.complete')
  async setPhotoConsent(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    // El cuerpo trae { consent: true | false }.
    @Body() body: { consent: boolean },
  ) {
    return this.appointmentsService.setPhotoConsent(id, tenantId, body.consent, user.userId);
  }

  // ── POST /api/appointments/:id/record-payment ───────────────────────────────
  // Registra el pago de la cita (método, monto, propina, descuento, notas).
  @Post(':id/record-payment')
  @RequirePermissions('appointments.complete')
  async recordPayment(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    // El cuerpo: paymentMethod es obligatorio; el resto (amount, tipAmount,
    // discountAmount, notes) es opcional (lleva "?").
    @Body()
    body: {
      paymentMethod: string;
      amount?: number;
      tipAmount?: number;
      discountAmount?: number;
      notes?: string;
    },
  ) {
    return this.appointmentsService.recordPayment(id, tenantId, body, user.userId);
  }

  // ── POST /api/appointments/:id/defer-to-pos ─────────────────────────────────
  // El empleado terminó pero el cliente pagará en recepción: deja la cita
  // "Por cobrar" (pendingPosPayment=true) para que aparezca en el POS.
  @Post(':id/defer-to-pos')
  @RequirePermissions('appointments.complete')
  async deferToPos(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.deferToPos(id, tenantId, user.userId);
  }

  /**
   * Genera (o devuelve si ya existe) el token de confirmación que el cliente
   * usa para confirmar el cobro y dejar su reseña desde su móvil.
   * Idempotente: regenerarlo devuelve el mismo token mientras no se haya
   * confirmado. Una vez confirmedAt está seteado, no se regenera.
   */
  // ── POST /api/appointments/:id/generate-confirmation-token ──────────────────
  @Post(':id/generate-confirmation-token')
  @RequirePermissions('appointments.complete')
  async generateConfirmationToken(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.generateConfirmationToken(id, tenantId);
  }

  /**
   * Lista citas pendientes de recordatorio WhatsApp para el admin.
   * Filtros: status PENDING/CONFIRMED, startTime entre ahora y ahora+36h,
   * reminderSentAt null (a menos que sentToday=true para ver enviados hoy).
   */
  // ── GET /api/appointments/reminders/pending ─────────────────────────────────
  // 'appointments.remind' (no 'read'): separa Recordatorios de Calendario; el rol
  // base staff no lo tiene, así que no ve ni accede a los recordatorios.
  @Get('reminders/pending')
  @RequirePermissions('appointments.remind')
  async pendingReminders(
    @CurrentTenant() tenantId: string,
    // @Query('hoursAhead') lee ?hoursAhead=N (texto). Es opcional ("?").
    @Query('hoursAhead') hoursAhead?: string,
    // @Query('sentToday') lee ?sentToday=true|false (texto). Opcional.
    @Query('sentToday') sentToday?: string,
  ) {
    // Si vino hoursAhead lo convertimos a número con Number(); si no, usamos 36.
    // (El ternario "condición ? A : B" elige A cuando hoursAhead tiene valor.)
    const hours = hoursAhead ? Number(hoursAhead) : 36;
    return this.appointmentsService.listPendingReminders(tenantId, {
      hoursAhead: hours,
      // sentToday === 'true' compara el TEXTO recibido con "true" y produce un
      // booleano real (true solo si la cadena es exactamente "true").
      sentToday: sentToday === 'true',
    });
  }

  /**
   * Marca la cita como "recordatorio enviado" (cuando el admin hace click
   * en el boton de WhatsApp). Tambien genera el confirmationToken si no
   * existe, para que el wa.me pueda incluir el link /c/:token.
   */
  // ── POST /api/appointments/:id/mark-reminder-sent ───────────────────────────
  @Post(':id/mark-reminder-sent')
  @RequirePermissions('appointments.remind')
  async markReminderSent(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.markReminderSent(id, tenantId);
  }

  // ─── COMPROBANTE DE PAGO (admin / POS) ───────────────
  // Sube/reemplaza la captura del comprobante de pago en una cita. Lo usa
  // el flujo de transferencia del POS cuando el cliente envía la captura
  // y el cajero la adjunta antes de confirmar el pago.
  @Post(':id/payment-proof')
  @RequirePermissions('appointments.complete')
  // @UseInterceptors + FileInterceptor('file') => espera UN archivo en el campo
  // "file" del formulario. limits.fileSize = 5 MB máximo (5 * 1024 * 1024 bytes).
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadPaymentProof(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    // @UploadedFile() entrega el archivo subido (o undefined si no vino).
    @UploadedFile() file: any,
  ) {
    // Si no llegó archivo, no hay nada que guardar -> error.
    if (!file) {
      throw new Error('Archivo requerido');
    }
    // Buscamos la cita (filtrando por tenantId para no tocar la de otro negocio).
    // Traemos solo paymentProofUrl: si ya había un comprobante, lo borraremos.
    const existing = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      select: { paymentProofUrl: true },
    });
    if (!existing) {
      throw new Error('Cita no encontrada');
    }
    // Guardamos el archivo en la carpeta "payments" y obtenemos su URL pública.
    const newUrl = await this.uploadsService.saveFile(file, 'payments');
    // Apuntamos la cita al nuevo comprobante.
    await this.prisma.appointment.update({
      where: { id },
      data: { paymentProofUrl: newUrl },
    });
    // Si había un comprobante anterior, lo borramos del disco para no acumular
    // basura. ".catch(() => {})" ignora cualquier error de borrado: aunque falle
    // limpiar el viejo, la operación principal (subir el nuevo) ya tuvo éxito.
    if (existing.paymentProofUrl) {
      await this.uploadsService.deleteFile(existing.paymentProofUrl).catch(() => {});
    }
    return { data: { paymentProofUrl: newUrl } };
  }

  // ── POST /api/appointments/:id/no-show ──────────────────────────────────────
  // Marca la cita como NO_SHOW (el cliente no se presentó).
  @Post(':id/no-show')
  // Mismo nivel que finalizar: marcar el desenlace de la cita (incl. empleado).
  @RequirePermissions('appointments.complete')
  async noShow(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.noShow(id, tenantId, user.userId);
  }

  // ─── APPOINTMENT PHOTOS ──────────────────────────────
  // (Fotos del RESULTADO del servicio, que el cliente puede ver luego.)

  // ── GET /api/appointments/:id/photos ────────────────────────────────────────
  // Lista las fotos de una cita, de la más antigua a la más nueva.
  @Get(':id/photos')
  @RequirePermissions('appointments.read')
  async getPhotos(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    // findMany = traer VARIOS registros. Filtramos por cita y negocio, y
    // ordenamos por createdAt ascendente (asc = de más viejo a más nuevo).
    const photos = await this.prisma.appointmentPhoto.findMany({
      where: { appointmentId: id, tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return { data: photos };
  }

  // ── POST /api/appointments/:id/photos ───────────────────────────────────────
  // Sube una foto del resultado, la asocia a la cita (y opcionalmente a un
  // servicio) y la auto-copia al portafolio del empleado.
  @Post(':id/photos')
  @RequirePermissions('appointments.complete')
  // Espera UN archivo en el campo "file" (sin límite explícito de tamaño aquí).
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @UploadedFile() file: any,
    // @Body('caption') lee SOLO el campo "caption" del cuerpo (texto, opcional).
    @Body('caption') caption?: string,
    // @Body('serviceId') lee SOLO el campo "serviceId" (opcional): a qué servicio
    // de la cita corresponde la foto.
    @Body('serviceId') serviceId?: string,
  ) {
    // Buscamos la cita (filtrada por negocio) y traemos su empleado y los
    // serviceId de sus items, para validar a quién pertenece la foto.
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        employeeId: true,
        items: { select: { serviceId: true } },
      },
    });
    if (!appointment) {
      throw new Error('Cita no encontrada');
    }

    // Validar que el serviceId pertenece a esta cita (si vino)
    // validatedServiceId arranca en null: si no validamos nada, la foto no se
    // asocia a un servicio concreto.
    let validatedServiceId: string | null = null;
    if (serviceId) {
      // some() recorre los items y devuelve true en cuanto UNO tenga ese
      // serviceId. Es decir: "¿alguno de los servicios de la cita es este?".
      const belongs = appointment.items.some((it) => it.serviceId === serviceId);
      if (!belongs) {
        // Si no pertenece, rechazamos para no asociar la foto a un servicio ajeno.
        throw new Error('El servicio no pertenece a esta cita');
      }
      validatedServiceId = serviceId;
    }

    // Guardamos el archivo en la carpeta "results" y obtenemos su URL.
    const imageUrl = await this.uploadsService.saveFile(file, 'results');

    // Creamos el registro de la foto de la cita (con quién la subió).
    const photo = await this.prisma.appointmentPhoto.create({
      data: {
        tenantId,
        appointmentId: id,
        serviceId: validatedServiceId,
        imageUrl,
        caption,
        uploadedById: user.userId,
      },
    });

    // Auto-copia al portafolio del empleado que atendio la cita. Asi la
    // foto del resultado queda disponible en el perfil publico del
    // profesional sin un paso manual extra. El empleado puede luego
    // ocultarla con el toggle "No mostrar" desde su portafolio.
    if (appointment.employeeId) {
      try {
        await this.prisma.employeePortfolioImage.create({
          data: {
            employeeId: appointment.employeeId,
            serviceId: validatedServiceId,
            imageUrl,
            // caption || null: si caption está vacío/undefined, guardamos null
            // (el "||" usa el segundo valor cuando el primero es "falsy").
            caption: caption || null,
            isHidden: false,
          },
        });
      } catch (e) {
        // Si falla la auto-copia no rompemos el upload principal. La
        // foto sigue en appointment_photos y la galeria del empleado.
        console.error('Auto-copy to portfolio failed:', e);
      }
    }

    return { data: photo };
  }

  // ── DELETE /api/appointments/:id/photos/:photoId ────────────────────────────
  // Borra una foto concreta de la cita (del disco y de la base de datos).
  @Delete(':id/photos/:photoId')
  @RequirePermissions('appointments.update')
  async deletePhoto(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    // Segundo parámetro de la URL: el id de la foto a borrar.
    @Param('photoId') photoId: string,
  ) {
    // Buscamos la foto verificando que pertenezca a esta cita y a este negocio
    // (triple filtro: id de foto + appointmentId + tenantId) por seguridad.
    const photo = await this.prisma.appointmentPhoto.findFirst({
      where: { id: photoId, appointmentId: id, tenantId },
    });

    if (!photo) {
      throw new Error('Foto no encontrada');
    }

    // Primero borramos el archivo físico y luego el registro en la BD.
    await this.uploadsService.deleteFile(photo.imageUrl);
    await this.prisma.appointmentPhoto.delete({ where: { id: photoId } });

    return { message: 'Foto eliminada' };
  }
}
