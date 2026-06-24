// ─────────────────────────────────────────────────────────────────────────────
// CONTROLADOR del portal del cliente.
// El controlador es la "puerta de entrada" HTTP: define los endpoints (las URLs)
// y, por cada uno, recibe la petición, saca los datos que necesita (params, body,
// usuario autenticado) y se los pasa al SERVICIO, que hace el trabajo real.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los decoradores para construir endpoints:
//   - Controller: marca la clase como controlador (grupo de rutas).
//   - Post/Get/Put: marcan un método como endpoint para ese verbo HTTP.
//   - Body: lee el cuerpo JSON de la petición.
//   - Param: lee un trozo variable de la URL (ej. :tenantSlug, :id).
//   - Query: lee un parámetro de la query string (ej. ?filter=upcoming).
//   - UseGuards: aplica un guard (portero) al endpoint.
//   - Req: da acceso al objeto "request" completo (donde está req.user).
//   - UseInterceptors / UploadedFile: para manejar subida de archivos (importados
//     por si se usan; en este controlador no hay endpoints de subida activos).
import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';

// FileInterceptor: ayudante para recibir un archivo en un formulario (multipart).
import { FileInterceptor } from '@nestjs/platform-express';

// Throttle: limitador de peticiones (anti-abuso/spam) por endpoint.
import { Throttle } from '@nestjs/throttler';

// El servicio con toda la lógica del portal.
import { ClientPortalService } from './client-portal.service';

// El guard que exige token de cliente válido.
import { ClientJwtGuard } from './guards/client-jwt.guard';

// Los DTOs que validan los cuerpos de las peticiones.
import { ClientRegisterDto } from './dto/client-register.dto';
import { ClientLoginDto } from './dto/client-login.dto';
import { ClientUpdateProfileDto, ClientChangePasswordDto } from './dto/client-update-profile.dto';
import { CreateReviewDto } from './dto/create-review.dto';

// @Controller('portal/:tenantSlug') => TODAS las rutas de esta clase empiezan con
// "/api/portal/<slug-del-negocio>". El ":tenantSlug" es una parte variable de la
// URL: identifica a qué negocio pertenece la petición.
@Controller('portal/:tenantSlug')
export class ClientPortalController {
  // Inyección de dependencias: NestJS crea el servicio y nos lo pasa. Queda
  // guardado como this.clientPortalService (readonly = no se puede reasignar).
  constructor(private readonly clientPortalService: ClientPortalService) {}

  // ─── AUTH (público, sin guard) ───────────────────────
  // Estos endpoints NO llevan @UseGuards porque son para entrar (aún no hay
  // token). En su lugar usan @Throttle para limitar intentos.

  // POST /api/portal/:tenantSlug/auth/register → crear cuenta de cliente.
  @Post('auth/register')
  // Máximo 5 registros por minuto (ttl 60000 ms) por IP: frena el spam de cuentas.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(
    // Lee el slug del negocio desde la URL.
    @Param('tenantSlug') slug: string,
    // Lee y valida el cuerpo con las reglas del ClientRegisterDto.
    @Body() dto: ClientRegisterDto,
  ) {
    // Primero traducimos el slug a un negocio real (con su id) en la base de datos.
    const tenant = await this.clientPortalService.resolveTenant(slug);
    // Luego registramos al cliente dentro de ese negocio (multi-tenant).
    return this.clientPortalService.register(dto, tenant.id);
  }

  // POST /api/portal/:tenantSlug/auth/login → iniciar sesión.
  @Post('auth/login')
  // Hasta 10 intentos de login por minuto: protege contra ataques de fuerza bruta.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(
    @Param('tenantSlug') slug: string,
    @Body() dto: ClientLoginDto,
  ) {
    const tenant = await this.clientPortalService.resolveTenant(slug);
    return this.clientPortalService.login(dto, tenant.id);
  }

  // POST /api/portal/:tenantSlug/auth/refresh → renovar el access token usando el
  // refresh token. (No necesita el slug; el refresh token ya identifica al cliente.)
  @Post('auth/refresh')
  // @Body('refreshToken') lee SOLO el campo "refreshToken" del JSON del cuerpo.
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.clientPortalService.refresh(refreshToken);
  }

  // POST /api/portal/:tenantSlug/auth/logout → cerrar sesión (revoca el refresh token).
  @Post('auth/logout')
  async logout(@Body('refreshToken') refreshToken: string) {
    await this.clientPortalService.logout(refreshToken);
    // Devolvemos un mensaje simple de confirmación.
    return { message: 'Sesión cerrada' };
  }

  // GET /api/portal/:tenantSlug/auth/me → datos del cliente autenticado.
  @Get('auth/me')
  // A partir de aquí, los endpoints SÍ exigen token de cliente (ClientJwtGuard).
  @UseGuards(ClientJwtGuard)
  // @Req() da acceso al request; req.user fue rellenado por la estrategia con
  // { clientId, tenantId, ... }.
  async getMe(@Req() req: any) {
    return this.clientPortalService.getMe(req.user.clientId, req.user.tenantId);
  }

  // ─── CITAS (APPOINTMENTS) ────────────────────────────

  // GET /api/portal/:tenantSlug/appointments?filter=upcoming|past|all
  // Lista las citas del cliente, filtradas por próximas, pasadas o todas.
  @Get('appointments')
  @UseGuards(ClientJwtGuard)
  async getAppointments(
    @Req() req: any,
    // @Query('filter') lee el parámetro "filter" de la URL. El "= 'all'" es un
    // valor por defecto: si no viene, asumimos "all" (todas).
    @Query('filter') filter: 'upcoming' | 'past' | 'all' = 'all',
  ) {
    return this.clientPortalService.getAppointments(
      req.user.clientId,
      req.user.tenantId,
      filter,
    );
  }

  // GET /api/portal/:tenantSlug/appointments/:id → detalle de UNA cita.
  @Get('appointments/:id')
  @UseGuards(ClientJwtGuard)
  // @Param('id') lee el id de la cita desde la URL.
  async getAppointmentDetail(@Param('id') id: string, @Req() req: any) {
    return this.clientPortalService.getAppointmentDetail(
      id,
      req.user.clientId,
      req.user.tenantId,
    );
  }

  // POST /api/portal/:tenantSlug/appointments/:id/cancel → cancelar una cita.
  @Post('appointments/:id/cancel')
  @UseGuards(ClientJwtGuard)
  async cancelAppointment(
    @Param('id') id: string,
    @Req() req: any,
    // Motivo OPCIONAL de cancelación (solo este campo del body).
    @Body('reason') reason?: string,
  ) {
    return this.clientPortalService.cancelAppointment(
      id,
      req.user.clientId,
      req.user.tenantId,
      reason,
    );
  }

  // POST /api/portal/:tenantSlug/appointments/:id/reschedule → reagendar.
  @Post('appointments/:id/reschedule')
  @UseGuards(ClientJwtGuard)
  async rescheduleAppointment(
    @Param('id') id: string,
    @Req() req: any,
    // Nueva fecha-hora de inicio (obligatoria).
    @Body('startTime') startTime: string,
    // Nuevo empleado OPCIONAL (por si el cliente cambia de profesional).
    @Body('employeeId') employeeId?: string,
  ) {
    return this.clientPortalService.rescheduleAppointment(
      id,
      req.user.clientId,
      req.user.tenantId,
      startTime,
      employeeId,
    );
  }

  // ─── RESEÑAS (REVIEWS) ───────────────────────────────

  // POST /api/portal/:tenantSlug/appointments/:id/review → dejar reseña de una cita.
  @Post('appointments/:id/review')
  @UseGuards(ClientJwtGuard)
  async createReview(
    @Param('id') id: string,
    @Req() req: any,
    // Cuerpo validado con CreateReviewDto (rating obligatorio 1-5, etc.).
    @Body() dto: CreateReviewDto,
  ) {
    return this.clientPortalService.createReview(
      id,
      req.user.clientId,
      req.user.tenantId,
      dto,
    );
  }

  // GET /api/portal/:tenantSlug/reviews → lista de reseñas que ha dejado el cliente.
  @Get('reviews')
  @UseGuards(ClientJwtGuard)
  async getMyReviews(@Req() req: any) {
    return this.clientPortalService.getMyReviews(
      req.user.clientId,
      req.user.tenantId,
    );
  }

  // ─── FOTOS ───────────────────────────────────────────

  // GET /api/portal/:tenantSlug/appointments/:id/photos → fotos de resultado de
  // una cita (las sube el personal del negocio; el cliente las puede ver).
  @Get('appointments/:id/photos')
  @UseGuards(ClientJwtGuard)
  async getAppointmentPhotos(@Param('id') id: string, @Req() req: any) {
    return this.clientPortalService.getAppointmentPhotos(
      id,
      req.user.clientId,
      req.user.tenantId,
    );
  }

  // GET /api/portal/:tenantSlug/service-history → historial de servicios del
  // cliente, agrupado por servicio y con sus fotos.
  @Get('service-history')
  @UseGuards(ClientJwtGuard)
  async getServiceHistory(@Req() req: any) {
    return this.clientPortalService.getServiceHistory(
      req.user.clientId,
      req.user.tenantId,
    );
  }

  // ─── RESERVAR (BOOKING) ──────────────────────────────

  // GET /api/portal/:tenantSlug/services → servicios disponibles para reservar.
  @Get('services')
  @UseGuards(ClientJwtGuard)
  // Aunque @Param('tenantSlug') está disponible, usamos req.user.tenantId (que
  // viene del token verificado) como fuente de verdad del negocio.
  async getServices(@Param('tenantSlug') slug: string, @Req() req: any) {
    return this.clientPortalService.getServices(req.user.tenantId);
  }

  // GET /api/portal/:tenantSlug/employees → profesionales disponibles.
  @Get('employees')
  @UseGuards(ClientJwtGuard)
  async getEmployees(@Param('tenantSlug') slug: string, @Req() req: any) {
    return this.clientPortalService.getEmployees(req.user.tenantId);
  }

  // POST /api/portal/:tenantSlug/availability → horarios libres para los servicios
  // y rango de fechas que envíe el cliente en el cuerpo.
  @Post('availability')
  @UseGuards(ClientJwtGuard)
  // @Body() body: any => recibimos el cuerpo completo sin un DTO estricto.
  async getAvailability(@Req() req: any, @Body() body: any) {
    return this.clientPortalService.getAvailability(
      body.serviceIds,   // lista de ids de servicios a reservar
      body.startDate,    // inicio del rango de búsqueda
      body.endDate,      // fin del rango
      req.user.tenantId, // negocio (del token)
      body.employeeId,   // empleado preferido (opcional)
      body.locationId,   // sucursal (opcional)
    );
  }

  // POST /api/portal/:tenantSlug/book → crear una reserva nueva.
  @Post('book')
  @UseGuards(ClientJwtGuard)
  // Máximo 5 reservas por minuto: evita abuso/spam de citas.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async book(@Req() req: any, @Body() body: any) {
    return this.clientPortalService.book(req.user.clientId, req.user.tenantId, {
      employeeId: body.employeeId,   // profesional elegido
      serviceIds: body.serviceIds,   // servicios a reservar
      startTime: body.startTime,     // hora de inicio
      notes: body.notes,             // notas opcionales
    });
  }

  // ─── PERFIL (PROFILE) ────────────────────────────────

  // PUT /api/portal/:tenantSlug/profile → actualizar datos del perfil.
  @Put('profile')
  @UseGuards(ClientJwtGuard)
  async updateProfile(@Req() req: any, @Body() dto: ClientUpdateProfileDto) {
    return this.clientPortalService.updateProfile(
      req.user.clientId,
      req.user.tenantId,
      dto,
    );
  }

  // PUT /api/portal/:tenantSlug/profile/password → cambiar la contraseña.
  @Put('profile/password')
  @UseGuards(ClientJwtGuard)
  async changePassword(@Req() req: any, @Body() dto: ClientChangePasswordDto) {
    return this.clientPortalService.changePassword(
      req.user.clientId,
      req.user.tenantId,
      dto,
    );
  }
}
