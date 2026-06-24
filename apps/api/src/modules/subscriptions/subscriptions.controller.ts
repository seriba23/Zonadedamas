// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los decoradores para declarar endpoints HTTP:
//   - Controller: marca la clase como "controlador" (un grupo de endpoints).
//   - Get: marca un método como endpoint que responde a peticiones HTTP GET.
//   - UseGuards: aplica "guardias" (controles de acceso) a la clase o método.
import { Controller, Get, UseGuards } from '@nestjs/common';

// Servicios con la lógica de verdad. El controlador solo recibe la petición y
// delega el trabajo en estos servicios:
//   - SubscriptionsService: lee la suscripción y las facturas.
//   - PlanLimitsService: calcula el consumo (usage) frente a los límites.
import { SubscriptionsService } from './subscriptions.service';
import { PlanLimitsService } from './plan-limits.service';

// JwtAuthGuard: guardia que exige un token JWT válido. Si la petición no trae un
// token correcto, se rechaza con 401 antes de llegar al método. Así protegemos
// estos endpoints para que solo entren usuarios autenticados.
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Del decorador de usuario actual importamos:
//   - CurrentUser: decorador que extrae el usuario (sacado del token) y lo
//     inyecta como argumento del método.
//   - JwtPayload: el tipo (molde) de ese usuario; incluye, entre otros, tenantId.
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

// @UseGuards(JwtAuthGuard) a nivel de CLASE => TODOS los endpoints de abajo
// requieren estar autenticado (token JWT válido).
@UseGuards(JwtAuthGuard)
// @Controller('subscription') => todas las rutas empiezan con "/api/subscription"
// (el prefijo "/api" se agrega globalmente en otra parte del proyecto).
@Controller('subscription')
export class SubscriptionsController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS: NestJS crea e inyecta ambos
  // servicios. "private readonly" los guarda como propiedades de solo lectura.
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly planLimitsService: PlanLimitsService,
  ) {}

  // ── GET /api/subscription ───────────────────────────────────────────────────
  // Devuelve la suscripción del negocio del usuario autenticado.
  @Get()
  async getSubscription(@CurrentUser() user: JwtPayload) {
    // @CurrentUser() inyecta el usuario sacado del token. De él tomamos su
    // tenantId (id del negocio) para pedir SU suscripción. "await" espera la
    // respuesta del servicio (que consulta la base de datos).
    const subscription = await this.subscriptionsService.getSubscription(user.tenantId);
    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data: subscription };
  }

  // ── GET /api/subscription/usage ─────────────────────────────────────────────
  // Devuelve cuánto lleva consumido el negocio frente a los límites de su plan.
  @Get('usage')
  async getUsage(@CurrentUser() user: JwtPayload) {
    // Pedimos al PlanLimitsService el resumen de consumo del negocio.
    const usage = await this.planLimitsService.getUsage(user.tenantId);
    return { data: usage };
  }

  // ── GET /api/subscription/invoices ──────────────────────────────────────────
  // Devuelve el historial de facturas del negocio.
  @Get('invoices')
  async getInvoices(@CurrentUser() user: JwtPayload) {
    // Pedimos al servicio la lista de facturas del negocio.
    const invoices = await this.subscriptionsService.getInvoices(user.tenantId);
    return { data: invoices };
  }
}
