// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Decoradores de NestJS para construir endpoints HTTP:
//   - Body: lee el cuerpo (JSON) de la petición.
//   - Controller: marca la clase como controlador (grupo de endpoints).
//   - Delete/Get/Post/Put: marcan métodos según el verbo HTTP que atienden.
//   - Param: lee un trozo variable de la URL (ej. :tenantSlug).
//   - Query: lee parámetros de la query string (ej. ?page=2).
//   - Req: da acceso al objeto "request" completo (de ahí sacamos req.user).
//   - UploadedFile: recibe un archivo subido (foto).
//   - UseGuards: aplica guards (control de acceso) a un endpoint.
//   - UseInterceptors: aplica interceptores (aquí, para procesar la subida).
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

// FileInterceptor: interceptor que toma UN archivo de un formulario (campo
// 'file') y lo deja disponible para @UploadedFile.
import { FileInterceptor } from '@nestjs/platform-express';

// El servicio con toda la lógica de marketplace.
import { MarketplaceService } from './marketplace.service';

// Todos los DTOs (validan los datos de entrada de cada endpoint).
import { MarketplaceRegisterDto } from './dto/marketplace-register.dto';
import { MarketplaceLoginDto } from './dto/marketplace-login.dto';
import { MarketplaceDiscoverDto } from './dto/marketplace-discover.dto';
import { UpdateMarketplaceProfileDto, UpdateMarketplaceSettingsDto } from './dto/update-marketplace-profile.dto';
import { ChangeMarketplacePasswordDto } from './dto/change-marketplace-password.dto';
import { ChangeMarketplaceContactDto } from './dto/change-marketplace-contact.dto';
import { MarketplaceBookDto } from './dto/marketplace-book.dto';
import { MarketplaceSocialLoginDto } from './dto/marketplace-social-login.dto';
import { CreateTenantReviewDto } from './dto/tenant-review.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileEntityDto } from './dto/update-profile-entity.dto';

// DTO y servicio de Stripe (pagos) para el checkout.
import { CreateCheckoutDto } from '../stripe/dto/create-checkout.dto';
import { StripeService } from '../stripe/stripe.service';

// Guards de marketplace: el obligatorio (corta sin token) y el opcional
// (deja pasar pero adjunta el usuario si hay token).
import { MarketplaceJwtGuard } from './guards/marketplace-jwt.guard';
import { MarketplaceJwtOptionalGuard } from './guards/marketplace-jwt-optional.guard';
import { CreateClientAddressDto } from './dto/client-address.dto';

// Guards y decoradores del PORTAL DEL NEGOCIO (staff), usados solo en el
// endpoint del QR: validan el JWT del empleado y sus permisos.
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

// Servicio para guardar/borrar archivos subidos (avatares, comprobantes).
import { UploadsService } from '../uploads/uploads.service';

// @Controller('marketplace') => todas las rutas empiezan con "/api/marketplace".
@Controller('marketplace')
export class MarketplaceController {
  // INYECCIÓN DE DEPENDENCIAS: NestJS crea e inyecta estos tres servicios.
  // "private readonly" los guarda como propiedades de solo lectura (this.xxx).
  constructor(
    private readonly marketplaceService: MarketplaceService, // lógica principal
    private readonly uploadsService: UploadsService,          // subir/borrar archivos
    private readonly stripeService: StripeService,            // pagos con Stripe
  ) {}

  // ─── AUTH (public) ───────────────────────────────────

  // POST /api/marketplace/auth/register => crea una cuenta nueva.
  @Post('auth/register')
  async register(@Body() dto: MarketplaceRegisterDto) {
    // Delegamos en el servicio (que valida y crea el usuario).
    const result = await this.marketplaceService.register(dto);
    // Respondemos en el formato estándar { data: ... }.
    return { data: result };
  }

  // POST /api/marketplace/auth/login => inicia sesión con email/teléfono + clave.
  @Post('auth/login')
  async login(@Body() dto: MarketplaceLoginDto) {
    const result = await this.marketplaceService.login(dto);
    return { data: result };
  }

  // POST /api/marketplace/auth/refresh => renueva el access token usando el
  // refresh token. @Body('refreshToken') extrae SOLO ese campo del JSON.
  @Post('auth/refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    const result = await this.marketplaceService.refresh(refreshToken);
    return { data: result };
  }

  // POST /api/marketplace/auth/logout => cierra sesión (invalida el refresh token).
  @Post('auth/logout')
  async logout(@Body('refreshToken') refreshToken: string) {
    await this.marketplaceService.logout(refreshToken);
    return { data: { message: 'Sesión cerrada' } };
  }

  // POST /api/marketplace/auth/social => login con Google/Facebook.
  @Post('auth/social')
  async socialLogin(@Body() dto: MarketplaceSocialLoginDto) {
    const result = await this.marketplaceService.socialLogin(dto);
    return { data: result };
  }

  // ─── RECLAMO DE CUENTA (invitación por WhatsApp desde un negocio) ─────

  // GET /api/marketplace/claim/:token => datos para PRELLENAR la página de
  // reclamo + si ya existe cuenta con ese teléfono/email (público).
  @Get('claim/:token')
  async getClaimPreview(@Param('token') token: string) {
    const data = await this.marketplaceService.getClaimPreview(token);
    return { data };
  }

  // POST /api/marketplace/claim/:token => un usuario YA logueado vincula a su
  // cuenta la ficha walk-in del negocio (unificación sin re-registrar).
  @UseGuards(MarketplaceJwtGuard)
  @Post('claim/:token')
  async claimClient(@Param('token') token: string, @Req() req: any) {
    const data = await this.marketplaceService.claimClient(token, req.user.marketplaceUserId);
    return { data };
  }

  // GET /api/marketplace/auth/me => datos del usuario logueado.
  // @UseGuards(MarketplaceJwtGuard) exige token válido. De req.user (que puso la
  // estrategia) sacamos el id del usuario para pasarlo al servicio.
  @UseGuards(MarketplaceJwtGuard)
  @Get('auth/me')
  async getMe(@Req() req: any) {
    const user = await this.marketplaceService.getMe(req.user.marketplaceUserId);
    return { data: user };
  }

  // PUT /api/marketplace/auth/profile => actualiza el perfil del usuario.
  @UseGuards(MarketplaceJwtGuard)
  @Put('auth/profile')
  async updateProfile(@Req() req: any, @Body() dto: UpdateMarketplaceProfileDto) {
    const user = await this.marketplaceService.updateProfile(req.user.marketplaceUserId, dto);
    return { data: user };
  }

  // ── Direcciones guardadas del cliente (servicio a domicilio) ──────────────
  @UseGuards(MarketplaceJwtGuard)
  @Get('addresses')
  async listAddresses(@Req() req: any) {
    const data = await this.marketplaceService.listClientAddresses(req.user.marketplaceUserId);
    return { data };
  }

  @UseGuards(MarketplaceJwtGuard)
  @Post('addresses')
  async createAddress(@Req() req: any, @Body() dto: CreateClientAddressDto) {
    const data = await this.marketplaceService.createClientAddress(req.user.marketplaceUserId, dto);
    return { data };
  }

  @UseGuards(MarketplaceJwtGuard)
  @Delete('addresses/:id')
  async deleteAddress(@Req() req: any, @Param('id') id: string) {
    const data = await this.marketplaceService.deleteClientAddress(req.user.marketplaceUserId, id);
    return { data };
  }

  // POST /api/marketplace/auth/otp/send => envía un código OTP al TELÉFONO.
  @UseGuards(MarketplaceJwtGuard)
  @Post('auth/otp/send')
  async sendOtp(@Req() req: any) {
    const result = await this.marketplaceService.sendOtp(req.user.marketplaceUserId);
    return { data: result };
  }

  // POST /api/marketplace/auth/otp/verify => verifica el código OTP del teléfono.
  @UseGuards(MarketplaceJwtGuard)
  @Post('auth/otp/verify')
  async verifyOtp(@Req() req: any, @Body('code') code: string) {
    const result = this.marketplaceService.verifyOtp(req.user.marketplaceUserId, code);
    return { data: result };
  }

  // POST /api/marketplace/auth/otp/send-email => envía un código OTP al CORREO.
  @UseGuards(MarketplaceJwtGuard)
  @Post('auth/otp/send-email')
  async sendOtpEmail(@Req() req: any) {
    const result = await this.marketplaceService.sendOtpEmail(req.user.marketplaceUserId);
    return { data: result };
  }

  // POST /api/marketplace/auth/otp/verify-email => verifica el OTP del correo.
  @UseGuards(MarketplaceJwtGuard)
  @Post('auth/otp/verify-email')
  async verifyOtpEmail(@Req() req: any, @Body('code') code: string) {
    const result = this.marketplaceService.verifyOtpEmail(req.user.marketplaceUserId, code);
    return { data: result };
  }

  // PUT /api/marketplace/auth/profile/password => cambia la contraseña.
  @UseGuards(MarketplaceJwtGuard)
  @Put('auth/profile/password')
  async changePassword(@Req() req: any, @Body() dto: ChangeMarketplacePasswordDto) {
    const result = await this.marketplaceService.changePassword(req.user.marketplaceUserId, dto);
    return { data: result };
  }

  // PUT /api/marketplace/auth/profile/contact => cambia email/teléfono.
  @UseGuards(MarketplaceJwtGuard)
  @Put('auth/profile/contact')
  async updateContact(@Req() req: any, @Body() dto: ChangeMarketplaceContactDto) {
    const user = await this.marketplaceService.updateContact(req.user.marketplaceUserId, dto);
    return { data: user };
  }

  // PUT /api/marketplace/auth/settings => guarda los ajustes (idioma, moneda...).
  @UseGuards(MarketplaceJwtGuard)
  @Put('auth/settings')
  async updateSettings(@Req() req: any, @Body() dto: UpdateMarketplaceSettingsDto) {
    const settings = await this.marketplaceService.updateSettings(req.user.marketplaceUserId, dto);
    return { data: settings };
  }

  // POST /api/marketplace/auth/suspend => suspende temporalmente la cuenta N días.
  @UseGuards(MarketplaceJwtGuard)
  @Post('auth/suspend')
  async suspendAccount(@Req() req: any, @Body() body: { days: number }) {
    const result = await this.marketplaceService.suspendAccount(req.user.marketplaceUserId, body.days);
    return { data: result };
  }

  // POST /api/marketplace/auth/reactivate => reactiva una cuenta suspendida.
  @UseGuards(MarketplaceJwtGuard)
  @Post('auth/reactivate')
  async reactivateAccount(@Req() req: any) {
    const result = await this.marketplaceService.reactivateAccount(req.user.marketplaceUserId);
    return { data: result };
  }

  // DELETE /api/marketplace/auth/account => elimina la cuenta (pide la contraseña
  // como confirmación de seguridad).
  @UseGuards(MarketplaceJwtGuard)
  @Delete('auth/account')
  async deleteAccount(@Req() req: any, @Body('password') password: string) {
    await this.marketplaceService.deleteAccount(req.user.marketplaceUserId, password);
    return { data: { message: 'Cuenta eliminada correctamente' } };
  }

  // POST /api/marketplace/auth/avatar => sube la foto de perfil.
  // @UseInterceptors(FileInterceptor('file', ...)) capta el archivo del campo
  // 'file'. limits.fileSize = 5 * 1024 * 1024 = 5 MB máximo permitido.
  @UseGuards(MarketplaceJwtGuard)
  @Post('auth/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAvatar(@Req() req: any, @UploadedFile() file: any) {
    // 1) Guardamos el archivo en la carpeta 'avatars' y obtenemos su URL.
    const imageUrl = await this.uploadsService.saveFile(file, 'avatars');
    // 2) Actualizamos el avatar del usuario; el servicio devuelve la URL ANTIGUA
    //    (si tenía una) para poder borrarla.
    const oldUrl = await this.marketplaceService.updateAvatar(req.user.marketplaceUserId, imageUrl);
    // 3) Si había una foto previa, la borramos para no acumular basura.
    if (oldUrl) {
      await this.uploadsService.deleteFile(oldUrl);
    }
    // 4) Devolvemos la nueva URL del avatar.
    return { data: { avatarUrl: imageUrl } };
  }

  // GET /api/marketplace/my-appointments => citas del usuario.
  // Los @Query con "= 'all'" / "= '1'" / "= '20'" son valores POR DEFECTO si el
  // parámetro no viene en la URL.
  @UseGuards(MarketplaceJwtGuard)
  @Get('my-appointments')
  async getMyAppointments(
    @Req() req: any,
    @Query('filter') filter: string = 'all',
    @Query('page') page: string = '1',
    @Query('perPage') perPage: string = '20',
    // profileId opcional: si viene, solo las citas de ese perfil; si no, todas
    // (vista "familia").
    @Query('profileId') profileId?: string,
  ) {
    return this.marketplaceService.getMyAppointments(
      req.user.marketplaceUserId,
      // "filter as ..." es un "cast": le decimos a TypeScript que tratamos el
      // texto como uno de esos tres valores permitidos.
      filter as 'upcoming' | 'past' | 'all',
      // parseInt(page, 10) convierte el texto a entero en base 10. "|| 1" usa 1
      // si la conversión falla (NaN se considera "falso").
      parseInt(page, 10) || 1,
      // Math.min(x, 100) limita el máximo a 100 por página (evita pedir miles).
      Math.min(parseInt(perPage, 10) || 20, 100),
      profileId || undefined,
    );
  }

  // POST /api/marketplace/my-appointments/:id/review
  // El cliente deja la reseña de su cita ya completada desde el marketplace.
  // Misma semántica que el flujo de confirm-payment (rating + opcional negocio
  // o profesional según el tipo de tenant). @Param('id') = id de la cita.
  @UseGuards(MarketplaceJwtGuard)
  @Post('my-appointments/:id/review')
  async createMyAppointmentReview(
    @Req() req: any,
    @Param('id') appointmentId: string,
    @Body() dto: { rating: number; comment?: string; businessRating?: number; businessComment?: string },
  ) {
    return this.marketplaceService.createReviewForMyAppointment(
      req.user.marketplaceUserId,
      appointmentId,
      dto,
    );
  }

  // POST /api/marketplace/my-appointments/:id/dismiss-review
  // El cliente omite la reseña de UNA cita (permanente, solo esa cita).
  @UseGuards(MarketplaceJwtGuard)
  @Post('my-appointments/:id/dismiss-review')
  async dismissMyAppointmentReview(
    @Req() req: any,
    @Param('id') appointmentId: string,
  ) {
    return this.marketplaceService.dismissMyAppointmentReview(
      req.user.marketplaceUserId,
      appointmentId,
    );
  }

  // GET /api/marketplace/my-purchases => compras de productos del usuario.
  @UseGuards(MarketplaceJwtGuard)
  @Get('my-purchases')
  async getMyPurchases(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('perPage') perPage: string = '20',
  ) {
    return this.marketplaceService.getMyPurchases(
      req.user.marketplaceUserId,
      parseInt(page, 10) || 1,
      Math.min(parseInt(perPage, 10) || 20, 100),
    );
  }

  // GET /api/marketplace/my-stats => estadísticas personales (gastos, visitas...).
  @UseGuards(MarketplaceJwtGuard)
  @Get('my-stats')
  async getMyStats(@Req() req: any, @Query('profileId') profileId?: string) {
    return this.marketplaceService.getMyStats(req.user.marketplaceUserId, profileId || undefined);
  }

  // ─── PERFILES (multi-perfil estilo Netflix) ─────────────
  // El tutor gestiona aquí sus perfiles (el suyo + los de sus hijos/menores).

  // GET /api/marketplace/profiles => lista los perfiles del usuario.
  @UseGuards(MarketplaceJwtGuard)
  @Get('profiles')
  async listProfiles(@Req() req: any) {
    return this.marketplaceService.listProfiles(req.user.marketplaceUserId);
  }

  // POST /api/marketplace/profiles => crea un perfil hijo/familiar.
  @UseGuards(MarketplaceJwtGuard)
  @Post('profiles')
  async createProfile(@Req() req: any, @Body() dto: CreateProfileDto) {
    return this.marketplaceService.createProfile(req.user.marketplaceUserId, dto);
  }

  // PUT /api/marketplace/profiles/:id => edita un perfil propio.
  @UseGuards(MarketplaceJwtGuard)
  @Put('profiles/:id')
  async updateProfileEntity(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateProfileEntityDto,
  ) {
    return this.marketplaceService.updateProfileEntity(req.user.marketplaceUserId, id, dto);
  }

  // DELETE /api/marketplace/profiles/:id => elimina (archiva) un perfil.
  @UseGuards(MarketplaceJwtGuard)
  @Delete('profiles/:id')
  async deleteProfile(@Req() req: any, @Param('id') id: string) {
    return this.marketplaceService.deleteProfile(req.user.marketplaceUserId, id);
  }

  // GET /api/marketplace/my-gallery => galería de fotos de resultados del usuario.
  @UseGuards(MarketplaceJwtGuard)
  @Get('my-gallery')
  async getMyGallery(@Req() req: any, @Query('profileId') profileId?: string) {
    return this.marketplaceService.getMyGallery(req.user.marketplaceUserId, profileId || undefined);
  }

  // DELETE /api/marketplace/my-gallery/:photoId => el cliente elimina una foto
  // de su galería (solo las suyas).
  @UseGuards(MarketplaceJwtGuard)
  @Delete('my-gallery/:photoId')
  async deleteGalleryPhoto(@Req() req: any, @Param('photoId') photoId: string) {
    return this.marketplaceService.deleteGalleryPhoto(req.user.marketplaceUserId, photoId);
  }

  // ─── PAYMENTS (auth required) ────────────────────────

  // GET /api/marketplace/my-payments => historial de pagos. status es opcional
  // (filtra por estado del pago).
  @UseGuards(MarketplaceJwtGuard)
  @Get('my-payments')
  async getMyPayments(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('perPage') perPage: string = '20',
    @Query('status') status?: string,
  ) {
    return this.marketplaceService.getMyPayments(
      req.user.marketplaceUserId,
      parseInt(page, 10) || 1,
      Math.min(parseInt(perPage, 10) || 20, 100),
      // Cast del texto a uno de los estados válidos o undefined si no vino.
      status as 'COMPLETED' | 'PENDING' | 'REFUNDED' | undefined,
    );
  }

  // POST /api/marketplace/appointments/:id/payment-proof
  // Cliente sube/reemplaza la captura del comprobante de pago en una
  // cita propia. Valida que la cita pertenece al usuario marketplace.
  @UseGuards(MarketplaceJwtGuard)
  @Post('appointments/:id/payment-proof')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAppointmentPaymentProof(
    @Req() req: any,
    @Param('id') appointmentId: string,
    @UploadedFile() file: any,
  ) {
    // Guardamos el archivo en la carpeta 'payments' y obtenemos su URL.
    const newUrl = await this.uploadsService.saveFile(file, 'payments');
    // Asociamos el comprobante a la cita; devuelve la URL anterior (si existía).
    const oldUrl = await this.marketplaceService.setAppointmentPaymentProof(
      req.user.marketplaceUserId,
      appointmentId,
      newUrl,
    );
    // Borramos el comprobante viejo. ".catch(() => {})" ignora cualquier error de
    // borrado para que no rompa la respuesta (el reemplazo ya quedó hecho).
    if (oldUrl) {
      await this.uploadsService.deleteFile(oldUrl).catch(() => {});
    }
    return { data: { paymentProofUrl: newUrl } };
  }

  // ─── FAVORITES (auth required) ────────────────────────

  // POST /api/marketplace/favorites/:tenantSlug => marca/desmarca favorito
  // (toggle: si estaba, lo quita; si no, lo agrega).
  @UseGuards(MarketplaceJwtGuard)
  @Post('favorites/:tenantSlug')
  async toggleFavorite(
    @Req() req: any,
    @Param('tenantSlug') tenantSlug: string,
    @Body('profileId') profileId?: string,
  ) {
    const result = await this.marketplaceService.toggleFavorite(
      req.user.marketplaceUserId,
      tenantSlug,
      profileId,
    );
    return { data: result };
  }

  // GET /api/marketplace/my-favorites => negocios favoritos del usuario.
  @UseGuards(MarketplaceJwtGuard)
  @Get('my-favorites')
  async getMyFavorites(@Req() req: any, @Query('profileId') profileId?: string) {
    return this.marketplaceService.getMyFavorites(req.user.marketplaceUserId, profileId);
  }

  // ─── DISCOVERY (public) ──────────────────────────────

  // GET /api/marketplace/discover => listado/búsqueda de negocios. @Query() (sin
  // nombre) recoge TODA la query string y la valida con MarketplaceDiscoverDto.
  // Sin guard: es público.
  @Get('discover')
  async discover(@Query() dto: MarketplaceDiscoverDto) {
    return this.marketplaceService.discover(dto);
  }

  // GET /api/marketplace/discover/:tenantSlug => detalle de un negocio.
  // Guard OPCIONAL: público, pero si hay login marcamos favoritos, etc.
  @UseGuards(MarketplaceJwtOptionalGuard)
  @Get('discover/:tenantSlug')
  async getBusinessDetail(
    @Req() req: any,
    @Param('tenantSlug') tenantSlug: string,
    @Query('profileId') profileId?: string,
  ) {
    // "req.user?.marketplaceUserId": el "?." (optional chaining) evita un error si
    // req.user es null (usuario no logueado): en ese caso da undefined.
    const marketplaceUserId = req.user?.marketplaceUserId;
    return this.marketplaceService.getBusinessDetail(tenantSlug, marketplaceUserId, profileId || undefined);
  }

  // GET /api/marketplace/discover/:tenantSlug/reviews => reseñas del negocio.
  // Guard opcional: si hay login, el servicio marca cuál reseña es del usuario.
  @UseGuards(MarketplaceJwtOptionalGuard)
  @Get('discover/:tenantSlug/reviews')
  async getTenantReviews(
    @Req() req: any,
    @Param('tenantSlug') tenantSlug: string,
  ) {
    return this.marketplaceService.getTenantReviews(tenantSlug, req.user?.marketplaceUserId);
  }

  // POST /api/marketplace/discover/:tenantSlug/reviews => crea o actualiza
  // ("upsert") la reseña del usuario para ese negocio. Requiere login.
  @UseGuards(MarketplaceJwtGuard)
  @Post('discover/:tenantSlug/reviews')
  async upsertTenantReview(
    @Req() req: any,
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateTenantReviewDto,
  ) {
    return this.marketplaceService.upsertTenantReview(tenantSlug, req.user.marketplaceUserId, dto);
  }

  // DELETE /api/marketplace/discover/:tenantSlug/reviews/me => borra la reseña
  // del propio usuario para ese negocio.
  @UseGuards(MarketplaceJwtGuard)
  @Delete('discover/:tenantSlug/reviews/me')
  async deleteTenantReview(
    @Req() req: any,
    @Param('tenantSlug') tenantSlug: string,
  ) {
    return this.marketplaceService.deleteTenantReview(tenantSlug, req.user.marketplaceUserId);
  }

  // POST /api/marketplace/professionals/favorites/:employeeId => marca/desmarca
  // un PROFESIONAL (empleado) como favorito.
  @UseGuards(MarketplaceJwtGuard)
  @Post('professionals/favorites/:employeeId')
  async toggleProfessionalFavorite(
    @Req() req: any,
    @Param('employeeId') employeeId: string,
    @Body('profileId') profileId?: string,
  ) {
    return this.marketplaceService.toggleProfessionalFavorite(req.user.marketplaceUserId, employeeId, profileId);
  }

  // GET /api/marketplace/professionals/my-favorites => profesionales favoritos.
  @UseGuards(MarketplaceJwtGuard)
  @Get('professionals/my-favorites')
  async getMyProfessionalFavorites(@Req() req: any, @Query('profileId') profileId?: string) {
    return this.marketplaceService.getMyProfessionalFavorites(req.user.marketplaceUserId, profileId);
  }

  // GET /api/marketplace/business-types => catálogo de tipos de negocio (público).
  @Get('business-types')
  async getBusinessTypes() {
    return this.marketplaceService.getBusinessTypes();
  }

  // GET /api/marketplace/service-catalog => catálogo de servicios (público).
  @Get('service-catalog')
  async getServiceCatalog() {
    return this.marketplaceService.getServiceCatalog();
  }

  // GET /api/marketplace/professions => catálogo de profesiones (público).
  @Get('professions')
  async getProfessions() {
    return this.marketplaceService.getProfessions();
  }

  // GET /api/marketplace/professionals => buscar profesionales (público).
  // Todos los @Query son opcionales (llevan "?"); convertimos lat/lng a número
  // solo si vienen (ternario "lat ? ... : undefined"), y perPage/page con
  // valores por defecto 30 y 1.
  @Get('professionals')
  async discoverProfessionals(
    @Query('search') search?: string,
    @Query('jobTitle') jobTitle?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('perPage') perPage?: string,
    @Query('page') page?: string,
  ) {
    return this.marketplaceService.discoverProfessionals({
      search,
      jobTitle,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : 30,
      page: page ? parseInt(page, 10) : 1,
    });
  }

  // GET /api/marketplace/professional/:tenantSlug/:employeeId => perfil público
  // de un profesional concreto dentro de un negocio.
  @Get('professional/:tenantSlug/:employeeId')
  async getProfessionalProfile(
    @Param('tenantSlug') tenantSlug: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.marketplaceService.getProfessionalProfile(tenantSlug, employeeId);
  }

  // ─── BOOKING (auth required) ─────────────────────────

  // POST /api/marketplace/book/:tenantSlug => reserva una cita. Requiere login.
  @UseGuards(MarketplaceJwtGuard)
  @Post('book/:tenantSlug')
  async book(
    @Req() req: any,
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: MarketplaceBookDto,
  ) {
    const result = await this.marketplaceService.bookAppointment(
      req.user.marketplaceUserId,
      tenantSlug,
      dto,
    );
    return { data: result };
  }

  // POST /api/marketplace/checkout/:tenantSlug => crea una sesión de pago de
  // Stripe para una cita. Le pasamos el propio stripeService al método del
  // servicio (que lo usa para crear la sesión).
  @UseGuards(MarketplaceJwtGuard)
  @Post('checkout/:tenantSlug')
  async checkout(
    @Req() req: any,
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateCheckoutDto,
  ) {
    const result = await this.marketplaceService.createCheckoutSession(
      req.user.marketplaceUserId,
      tenantSlug,
      dto.appointmentId,
      this.stripeService,
      dto.returnUrl,
    );
    return { data: result };
  }

  // ─── REWARDS (auth required) ────────────────────────

  // GET /api/marketplace/my-rewards => cupones/recompensas canjeados del usuario.
  @UseGuards(MarketplaceJwtGuard)
  @Get('my-rewards')
  async getMyRewards(@Req() req: any, @Query('profileId') profileId?: string) {
    return this.marketplaceService.getMyRewards(req.user.marketplaceUserId, profileId);
  }

  // GET /api/marketplace/my-referrals => referidos del usuario.
  @UseGuards(MarketplaceJwtGuard)
  @Get('my-referrals')
  async getMyReferrals(@Req() req: any) {
    return this.marketplaceService.getMyReferrals(req.user.marketplaceUserId);
  }

  // GET /api/marketplace/available-rewards => recompensas disponibles para canjear.
  @UseGuards(MarketplaceJwtGuard)
  @Get('available-rewards')
  async getAvailableRewards(@Req() req: any) {
    return this.marketplaceService.getAvailableRewards(req.user.marketplaceUserId);
  }

  // GET /api/marketplace/referral/:code => info de un código de referido (público).
  @Get('referral/:code')
  async getReferralInfo(@Param('code') code: string) {
    return this.marketplaceService.getReferralInfo(code);
  }

  // GET /api/marketplace/:tenantSlug/rewards => recompensas de un negocio (público).
  @Get(':tenantSlug/rewards')
  async getBusinessRewards(@Param('tenantSlug') tenantSlug: string) {
    return this.marketplaceService.getBusinessRewards(tenantSlug);
  }

  // POST /api/marketplace/rewards/redeem => canjea una recompensa de un negocio.
  @UseGuards(MarketplaceJwtGuard)
  @Post('rewards/redeem')
  async redeemReward(
    @Req() req: any,
    @Body() body: { rewardId: string; tenantSlug: string; profileId?: string },
  ) {
    const result = await this.marketplaceService.redeemReward(
      req.user.marketplaceUserId,
      body.tenantSlug,
      body.rewardId,
      body.profileId,
    );
    return { data: result };
  }

  // ─── ENTER BUSINESS (auth required) ──────────────────

  // POST /api/marketplace/enter/:tenantSlug => "entrar" a un negocio (registra al
  // usuario como cliente de ese negocio y devuelve su contexto).
  @UseGuards(MarketplaceJwtGuard)
  @Post('enter/:tenantSlug')
  async enterBusiness(
    @Req() req: any,
    @Param('tenantSlug') tenantSlug: string,
    // El front puede mandar el perfil activo (tutor o hijo) en el cuerpo.
    @Body('profileId') profileId?: string,
  ) {
    const result = await this.marketplaceService.enterBusiness(
      req.user.marketplaceUserId,
      tenantSlug,
      profileId || undefined,
    );
    return { data: result };
  }

  // ─── QR (staff auth) ────────────────────────────────

  // GET /api/marketplace/qr => datos para generar el código QR del negocio.
  // ESTE endpoint NO es del usuario marketplace, sino del STAFF (empleado del
  // negocio): por eso usa JwtAuthGuard + PermissionGuard y exige el permiso
  // 'tenant.read'. @CurrentTenant() saca el id del negocio desde el JWT del staff.
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.read')
  @Get('qr')
  async getQrData(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.marketplaceService.getQrData(tenantId, locationId);
  }
}
