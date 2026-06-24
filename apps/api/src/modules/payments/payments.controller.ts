// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los "decoradores" (etiquetas "@") para declarar endpoints:
//   - Body: lee el cuerpo (JSON) que el cliente envía en un POST.
//   - Controller: marca una clase como controlador (un grupo de endpoints).
//   - Get / Post: marcan un método como endpoint que responde a GET o POST.
//   - Param: lee un trozo de la URL (ej. el :id de /payments/:id).
//   - Query: lee parámetros de la query string (ej. ?clientId=...&page=2).
//   - UseGuards: aplica "guardias" (controles de seguridad) al controlador.
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
// El servicio de pagos (la lógica real) y el tipo PaymentFilters (la forma de
// los filtros que se aceptan en el listado). El controlador solo recibe la
// petición y se la pasa al servicio.
import { PaymentsService, PaymentFilters } from './payments.service';
// El DTO (estructura validada) del cuerpo para crear un pago.
import { CreatePaymentDto } from './dto/create-payment.dto';
// JwtAuthGuard = guardia que exige un token JWT válido (el usuario debe estar
// autenticado para usar estos endpoints).
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// PermissionGuard = guardia que además comprueba que el usuario tenga el
// permiso requerido por cada endpoint (ver @RequirePermissions abajo).
import { PermissionGuard } from '../../common/guards/permission.guard';
// RequirePermissions = decorador que declara QUÉ permiso necesita un endpoint
// (formato "modulo.accion", ej. "payments.create").
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
// CurrentTenant = decorador que extrae del token el id del negocio (tenant) al
// que pertenece el usuario, para filtrar todo por ese negocio (multi-inquilino).
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
// CurrentUser = decorador que extrae del token los datos del usuario que hace la
// petición (entre ellos su userId).
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// @Controller('payments') => todas las rutas de esta clase empiezan con
// "/api/payments". (El prefijo "/api" se agrega globalmente en otra parte.)
@Controller('payments')
// @UseGuards(...) aplica AMBAS guardias a TODOS los endpoints de la clase:
// primero exige estar autenticado (JwtAuthGuard) y luego tener el permiso
// adecuado (PermissionGuard). El orden importa: primero autenticar, luego autorizar.
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PaymentsController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS:
  // NestJS crea el servicio y lo "inyecta" aquí. "private readonly" lo guarda
  // como propiedad de solo lectura (this.paymentsService) para usarlo abajo.
  constructor(private readonly paymentsService: PaymentsService) {}

  // ── POST /api/payments ────────────────────────────────────────────────────
  // Crea un nuevo pago (cobro). Requiere el permiso "payments.create".
  @Post()
  @RequirePermissions('payments.create')
  async create(
    // tenantId = id del negocio, extraído del token con @CurrentTenant().
    @CurrentTenant() tenantId: string,
    // user = datos del usuario autenticado. Es "any" (tipo libre) porque aquí
    // solo nos interesa leer su userId más abajo.
    @CurrentUser() user: any,
    // dto = el cuerpo JSON ya validado contra CreatePaymentDto.
    @Body() dto: CreatePaymentDto,
  ) {
    // Pasamos todo al servicio: los datos del pago, el negocio y quién lo crea
    // (user.userId). Devolvemos directamente lo que el servicio responda.
    return this.paymentsService.create(dto, tenantId, user.userId);
  }

  // ── GET /api/payments ─────────────────────────────────────────────────────
  // Lista los pagos del negocio (con filtros y paginación). Permiso "payments.read".
  @Get()
  @RequirePermissions('payments.read')
  async findAll(
    @CurrentTenant() tenantId: string,
    // filters = los parámetros de la URL (?clientId=...&startDate=...&page=...),
    // ya transformados a un objeto PaymentFilters.
    @Query() filters: PaymentFilters,
  ) {
    return this.paymentsService.findAll(tenantId, filters);
  }

  // ── GET /api/payments/:id ─────────────────────────────────────────────────
  // Devuelve el detalle de UN pago por su id. Permiso "payments.read".
  @Get(':id')
  @RequirePermissions('payments.read')
  async findOne(
    @CurrentTenant() tenantId: string,
    // @Param('id') toma el valor que venga en la posición :id de la URL.
    @Param('id') id: string,
  ) {
    // Pasamos el id y el negocio: el servicio garantiza que el pago pertenezca
    // a ESE negocio (seguridad multi-inquilino).
    return this.paymentsService.findOne(id, tenantId);
  }
}
