// ─────────────────────────────────────────────────────────────────────────────
// CONTROLADOR: recibe las peticiones HTTP del super-admin (panel de plataforma)
// y las delega a los servicios. NO contiene lógica de negocio: solo "traduce"
// la llamada HTTP (URL, parámetros, cuerpo) en una llamada a un método del
// servicio y devuelve su resultado.
// ─────────────────────────────────────────────────────────────────────────────

// Decoradores de NestJS para declarar el controlador y sus endpoints:
import {
  Controller, // marca la clase como controlador (grupo de rutas).
  Get,        // método que responde a peticiones HTTP GET (leer datos).
  Post,       // responde a POST (crear / ejecutar acciones).
  Patch,      // responde a PATCH (modificar parcialmente un recurso).
  Delete,     // responde a DELETE (borrar un recurso).
  Param,      // lee un trozo variable de la URL (ej. :id).
  Query,      // lee parámetros de la query string (ej. ?page=2).
  Body,       // lee el cuerpo (JSON) de la petición.
  UseGuards,  // aplica un "guardia" (control de acceso) a la clase/método.
  Req,        // da acceso al objeto Request crudo (para leer req.user, etc.).
} from '@nestjs/common';
// Los dos servicios con la lógica real:
import { CreatorCodesService } from './creator-codes.service';
import { CreatorPayoutsService } from './creator-payouts.service';
// Guard que exige un JWT válido de super-admin de la plataforma. Sin él, no se
// puede acceder a NINGÚN endpoint de esta clase.
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
// Los DTO que validan el cuerpo de las peticiones de crear/actualizar.
import { CreateInfluencerDto, UpdateInfluencerDto } from './dto/influencer.dto';

// @UseGuards a nivel de CLASE: protege TODOS los endpoints de abajo. Solo un
// super-admin autenticado (token válido) puede llamarlos.
@UseGuards(PlatformJwtAuthGuard)
// @Controller('platform/influencers') => todas las rutas empiezan con
// "/api/platform/influencers" (el prefijo "/api" se añade globalmente).
@Controller('platform/influencers')
export class CreatorCodesController {
  // INYECCIÓN DE DEPENDENCIAS: NestJS crea e inyecta ambos servicios. Quedan
  // guardados como this.service y this.payouts (readonly = no se reasignan).
  constructor(
    private readonly service: CreatorCodesService,
    private readonly payouts: CreatorPayoutsService,
  ) {}

  // ── GET /api/platform/influencers ──────────────────────────────────────────
  // Lista paginada de influencers, con filtros opcionales.
  @Get()
  async list(
    // Todos los @Query llevan "?": son opcionales. Llegan como TEXTO (string).
    @Query('page') page?: string,       // número de página
    @Query('perPage') perPage?: string, // cuántos por página
    @Query('status') status?: string,   // filtro por estado
    @Query('search') search?: string,   // texto a buscar
  ) {
    return this.service.listInfluencers({
      // "page ? parseInt(page, 10) : undefined":
      //   si "page" tiene valor (no es vacío/undefined), lo convierte a número
      //   con parseInt en base 10; si no, pasa undefined (el servicio usará su
      //   valor por defecto). El "10" es la base decimal del número.
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      status,
      search,
    });
  }

  // ── GET /api/platform/influencers/:id ──────────────────────────────────────
  // Detalle de UN influencer (con sus códigos, clientes referidos y comisiones).
  @Get(':id')
  async detail(@Param('id') id: string) {
    // @Param('id') toma el valor de la posición :id de la URL.
    return this.service.getInfluencerDetail(id);
  }

  // ── POST /api/platform/influencers ─────────────────────────────────────────
  // Crea un influencer. El cuerpo se valida con CreateInfluencerDto.
  @Post()
  async create(@Body() dto: CreateInfluencerDto, @Req() req: any) {
    // req.user.userId = el id del super-admin autenticado (lo puso el guard al
    // validar el JWT). Se lo pasamos al servicio para registrar quién lo creó.
    return this.service.createInfluencer(dto, req.user.userId);
  }

  // ── PATCH /api/platform/influencers/:id ────────────────────────────────────
  // Actualiza datos de un influencer. El cuerpo se valida con UpdateInfluencerDto.
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateInfluencerDto) {
    return this.service.updateInfluencer(id, dto);
  }

  // ── POST /api/platform/influencers/:id/approve ─────────────────────────────
  // Aprueba al influencer y le genera su código automáticamente.
  @Post(':id/approve')
  async approve(@Param('id') id: string, @Req() req: any) {
    // De nuevo pasamos el id del admin que aprueba (para dejar constancia).
    return this.service.approveInfluencer(id, req.user.userId);
  }

  // ── POST /api/platform/influencers/:id/suspend ─────────────────────────────
  // Suspende a un influencer (deja de poder operar, pero no se borra).
  @Post(':id/suspend')
  async suspend(@Param('id') id: string) {
    return this.service.suspendInfluencer(id);
  }

  // ── POST /api/platform/influencers/:id/reactivate ──────────────────────────
  // Reactiva a un influencer que estaba suspendido.
  @Post(':id/reactivate')
  async reactivate(@Param('id') id: string) {
    return this.service.reactivateInfluencer(id);
  }

  // ── DELETE /api/platform/influencers/:id ───────────────────────────────────
  // Elimina a un influencer (solo si no tiene historial de comisiones).
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.deleteInfluencer(id);
  }

  // ─── STRIPE CONNECT ───────────────────────────────

  // ── GET /api/platform/influencers/:id/stripe/status ────────────────────────
  // Consulta si el influencer ya completó su configuración de cobros en Stripe.
  @Get(':id/stripe/status')
  async stripeStatus(@Param('id') id: string) {
    return this.service.getStripeStatus(id);
  }

  // ── POST /api/platform/influencers/:id/stripe/onboarding-link ──────────────
  // Genera un link de Stripe para que el influencer configure dónde recibir su
  // dinero (sus comisiones). El cuerpo puede traer "returnUrl" (a dónde volver
  // tras terminar en Stripe).
  @Post(':id/stripe/onboarding-link')
  async stripeOnboardingLink(
    @Param('id') id: string,
    @Body() body: { returnUrl?: string },
  ) {
    // Decidimos la URL de retorno con una cadena de "||" (OR lógico): se usa el
    // PRIMER valor que NO sea vacío/undefined.
    //   1) body?.returnUrl  (lo que mandó el cliente, si mandó algo)
    //   2) si no, process.env.WEB_URL (la URL del sitio en variables de entorno)
    //   3) si tampoco, 'http://localhost:3000' (valor por defecto en desarrollo)
    // y al final se le concatena la ruta del panel de creadores.
    const returnUrl =
      body?.returnUrl || `${process.env.WEB_URL || 'http://localhost:3000'}/platform/creators`;
    return this.service.createStripeOnboardingLink(id, returnUrl);
  }

  // ─── ACCESO AL PANEL ──────────────────────────────

  // ── POST /api/platform/influencers/:id/access/generate-password ────────────
  // Genera una contraseña temporal para que el influencer entre a su panel.
  @Post(':id/access/generate-password')
  async generatePassword(@Param('id') id: string) {
    return this.service.generatePassword(id);
  }

  // ── POST /api/platform/influencers/:id/access/invite-link ──────────────────
  // Genera un link de invitación para que el influencer fije su propia contraseña.
  @Post(':id/access/invite-link')
  async inviteLink(@Param('id') id: string) {
    return this.service.createInviteLink(id);
  }

  // ─── COMISIONES / PAYOUTS ─────────────────────────

  // ── POST /api/platform/influencers/payouts/run ─────────────────────────────
  // Dispara manualmente la corrida mensual de comisiones (útil para pruebas).
  @Post('payouts/run')
  async runPayouts() {
    // "await" espera a que termine el cálculo de comisiones (consulta DB + Stripe).
    const result = await this.payouts.processMonthlyCommissions();
    // Envolvemos el resultado en el formato estándar { data: ... }.
    return { data: result };
  }

  // ── POST /api/platform/influencers/:id/payouts/retry ───────────────────────
  // Reintenta los transfers pendientes de un influencer ya onboardeado.
  @Post(':id/payouts/retry')
  async retryPayouts(@Param('id') id: string) {
    const result = await this.payouts.retryPendingTransfers(id);
    return { data: result };
  }
}
