// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS, los decoradores para construir endpoints HTTP:
//   - Controller: marca la clase como controlador (grupo de endpoints).
//   - Get / Patch / Post / Delete: marcan un método como endpoint de ese verbo
//     HTTP (leer / modificar parcialmente / crear / borrar).
//   - Param: lee un trozo de la URL (ej. el :id de /platform/tenants/:id).
//   - Query: lee un parámetro de la query string (ej. ?page=2).
//   - Body: lee el cuerpo (JSON) enviado en POST/PATCH.
//   - UseGuards: aplica un guard (aquí, exigir token de super-admin).
import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';

// El servicio con toda la lógica real de la consola del super-admin.
import { PlatformAdminService } from './platform-admin.service';

// El guard que protege estas rutas exigiendo un JWT válido de super-admin.
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';

// Tipos generados por Prisma a partir de la base de datos:
//   - SubscriptionPlan: los planes posibles (BASICO, PLUS, PRO).
//   - SubscriptionStatus: los estados posibles (ACTIVE, PAST_DUE, etc.).
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

// De class-validator, decoradores que validan los campos de los DTO:
//   - IsString: debe ser texto.   - IsIn: debe ser uno de una lista cerrada.
//   - IsOptional: el campo puede faltar.   - IsEnum: debe pertenecer a un enum.
//   - IsInt: número entero.   - Min/Max: valor mínimo/máximo permitido.
import { IsString, IsIn, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';

// Type: de class-transformer; sirve para CONVERTIR el tipo de un campo entrante
// (ej. transformar el texto "5" recibido en la petición a número 5) antes de validar.
import { Type } from 'class-transformer';

// DTO para cambiar el ESTADO de la suscripción de un negocio.
class UpdateStatusDto {
  // @IsIn([...]) obliga a que "status" sea exactamente uno de estos cuatro valores.
  @IsIn(['ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'])
  status: SubscriptionStatus;
}

// DTO para cambiar el PLAN de la suscripción de un negocio.
class UpdatePlanDto {
  // El plan debe ser uno de estos tres valores válidos.
  @IsIn(['BASICO', 'PLUS', 'PRO'])
  plan: SubscriptionPlan;
}

// DTO para desactivar un empleado eligiendo qué hacer con sus citas futuras.
class DeactivateEmployeeByAdminDto {
  // "strategy" debe ser una de las tres estrategias: mantener, cancelar o reagendar.
  @IsIn(['KEEP', 'CANCEL', 'SMART_RESCHEDULE'])
  // El tipo "'KEEP' | 'CANCEL' | 'SMART_RESCHEDULE'" es una "unión de literales":
  // solo se aceptan exactamente esos tres textos.
  strategy: 'KEEP' | 'CANCEL' | 'SMART_RESCHEDULE';
}

// DTO para "regalar" meses gratis a un negocio.
class GrantMonthsDto {
  // @Type(() => Number) convierte el valor recibido (que llega como texto) a número.
  @Type(() => Number)
  @IsInt()    // debe ser un entero.
  @Min(1)     // mínimo 1 mes.
  @Max(60)    // máximo 60 meses (5 años).
  months: number;
}

// @UseGuards(PlatformJwtAuthGuard) a NIVEL DE CLASE: protege TODOS los endpoints de
// este controlador (no hace falta repetirlo en cada método).
@UseGuards(PlatformJwtAuthGuard)
// @Controller('platform') => todas las rutas empiezan con "/api/platform".
@Controller('platform')
export class PlatformAdminController {
  // Inyección del servicio: NestJS lo crea y lo guarda en this.adminService.
  constructor(private readonly adminService: PlatformAdminService) {}

  // ── GET /api/platform/dashboard ───────────────────────────────────────────
  // Devuelve los KPIs (métricas) generales de la plataforma para el panel inicial.
  @Get('dashboard')
  async getDashboard() {
    const data = await this.adminService.getDashboard();
    return { data };
  }

  // ── GET /api/platform/tenants ─────────────────────────────────────────────
  // Lista paginada de negocios (tenants) con filtros opcionales de búsqueda.
  @Get('tenants')
  async getTenants(
    // Cada @Query lee un parámetro de la URL. El "?" indica que es opcional: si no
    // viene en la URL, llega como undefined. Todos llegan como texto (string).
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('plan') plan?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('tenantType') tenantType?: string,
    // ?new=month => solo los negocios registrados en el mes actual (KPI "Nuevos este mes").
    @Query('new') createdIn?: string,
  ) {
    return this.adminService.getTenants({
      // "page ? parseInt(page, 10) : undefined" es un ternario:
      //   - si "page" tiene valor, lo convertimos a número entero en base 10;
      //   - si no, pasamos undefined (el servicio aplicará su valor por defecto).
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      // Los demás filtros se pasan tal cual (ya son texto u opcional/undefined).
      plan,
      status,
      search,
      sortBy,
      tenantType,
      createdThisMonth: createdIn === 'month',
    });
  }

  // ── GET /api/platform/tenants/:id ─────────────────────────────────────────
  // Devuelve el detalle completo de UN negocio (usuarios, empleados, facturas...).
  @Get('tenants/:id')
  async getTenantDetail(@Param('id') id: string) {
    const data = await this.adminService.getTenantDetail(id);
    return { data };
  }

  // ── PATCH /api/platform/tenants/:id/status ────────────────────────────────
  // Cambia el ESTADO de la suscripción del negocio (activar, suspender, etc.).
  @Patch('tenants/:id/status')
  async updateTenantStatus(
    @Param('id') id: string,          // id del negocio (de la URL).
    @Body() dto: UpdateStatusDto,     // cuerpo validado: { status }.
  ) {
    const data = await this.adminService.updateTenantStatus(id, dto.status);
    return { data };
  }

  // ── PATCH /api/platform/tenants/:id/plan ──────────────────────────────────
  // Cambia el PLAN de la suscripción del negocio (BASICO/PLUS/PRO).
  @Patch('tenants/:id/plan')
  async updateTenantPlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    const data = await this.adminService.updateTenantPlan(id, dto.plan);
    return { data };
  }

  // ── POST /api/platform/tenants/:id/grant-months ───────────────────────────
  // Regala "months" meses gratis al negocio (extiende su periodo de prueba/cobro).
  @Post('tenants/:id/grant-months')
  async grantFreeMonths(
    @Param('id') id: string,
    @Body() dto: GrantMonthsDto,      // cuerpo validado: { months } (1..60).
  ) {
    return this.adminService.grantFreeMonths(id, dto.months);
  }

  // ── GET /api/platform/invoices ────────────────────────────────────────────
  // Lista paginada de TODAS las facturas de la plataforma (de todos los negocios).
  @Get('invoices')
  async getInvoices(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getAllInvoices({
      // Mismo patrón ternario: convertir a número si viene, si no undefined.
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      status,
    });
  }

  // ── POST /api/platform/invoices/:id/mark-paid ─────────────────────────────
  // Marca una factura como PAGADA (y reactiva el negocio si estaba moroso).
  @Post('invoices/:id/mark-paid')
  async markInvoicePaid(@Param('id') id: string) {
    const data = await this.adminService.markInvoicePaid(id);
    return { data };
  }

  // ── POST /api/platform/invoices/:id/mark-overdue ──────────────────────────
  // Marca una factura como VENCIDA (y pone el negocio en periodo de gracia).
  @Post('invoices/:id/mark-overdue')
  async markInvoiceOverdue(@Param('id') id: string) {
    const data = await this.adminService.markInvoiceOverdue(id);
    return { data };
  }

  // ── GET /api/platform/tenants/:tenantId/employees/:employeeId/pending-count ─
  // Cuenta cuántas citas futuras tiene un empleado (antes de desactivarlo).
  @Get('tenants/:tenantId/employees/:employeeId/pending-count')
  async getEmployeePendingCount(
    // Esta ruta tiene DOS parámetros en la URL: el negocio y el empleado.
    @Param('tenantId') tenantId: string,
    @Param('employeeId') employeeId: string,
  ) {
    const data = await this.adminService.getEmployeePendingCount(tenantId, employeeId);
    return { data };
  }

  // ── POST /api/platform/tenants/:tenantId/employees/:employeeId/deactivate ──
  // Desactiva un empleado de un negocio aplicando la estrategia elegida para sus citas.
  @Post('tenants/:tenantId/employees/:employeeId/deactivate')
  async deactivateEmployee(
    @Param('tenantId') tenantId: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: DeactivateEmployeeByAdminDto,   // { strategy }.
  ) {
    const data = await this.adminService.deactivateEmployee(tenantId, employeeId, dto.strategy);
    return { data };
  }

  // ─── NOTIFICATION LOGS (registros de notificaciones enviadas) ───────────────

  // ── GET /api/platform/notification-logs ───────────────────────────────────
  // Lista paginada del historial global de notificaciones (enviadas/fallidas).
  @Get('notification-logs')
  async getNotificationLogs(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getNotificationLogs({
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      status,
    });
  }

  // ─── BUSINESS TYPES (catálogo de tipos de negocio) ──────────────────────────

  // ── GET /api/platform/business-types ──────────────────────────────────────
  // Lista todos los tipos de negocio configurables (Salon, Barberia, SPA...).
  @Get('business-types')
  async getBusinessTypes() {
    return this.adminService.getBusinessTypes();
  }

  // ── POST /api/platform/business-types ─────────────────────────────────────
  // Crea un nuevo tipo de negocio. El cuerpo trae "value" (clave) y "label" (texto).
  @Post('business-types')
  async createBusinessType(@Body() body: { value: string; label: string }) {
    return this.adminService.createBusinessType(body.value, body.label);
  }

  // ── PATCH /api/platform/business-types/:id ────────────────────────────────
  // Edita un tipo de negocio. Los campos son opcionales (el "?" del tipo).
  @Patch('business-types/:id')
  async updateBusinessType(@Param('id') id: string, @Body() body: { value?: string; label?: string }) {
    return this.adminService.updateBusinessType(id, body);
  }

  // ── DELETE /api/platform/business-types/:id ───────────────────────────────
  // Borra un tipo de negocio por su id.
  @Delete('business-types/:id')
  async deleteBusinessType(@Param('id') id: string) {
    return this.adminService.deleteBusinessType(id);
  }

  // ─── SERVICE CATALOG (catálogo global de servicios) ─────────────────────────

  // ── GET /api/platform/service-catalog ─────────────────────────────────────
  // Lista todos los servicios del catálogo maestro.
  @Get('service-catalog')
  async getServiceCatalog() {
    return this.adminService.getServiceCatalog();
  }

  // ── POST /api/platform/service-catalog ────────────────────────────────────
  // Crea un servicio en el catálogo. "category" es opcional.
  @Post('service-catalog')
  async createServiceCatalogItem(@Body() body: { name: string; category?: string; description?: string }) {
    return this.adminService.createServiceCatalogItem(body.name, body.category, body.description);
  }

  // ── PATCH /api/platform/service-catalog/:id ───────────────────────────────
  // Edita un servicio del catálogo (nombre, categoría y/o descripción por defecto).
  @Patch('service-catalog/:id')
  async updateServiceCatalogItem(@Param('id') id: string, @Body() body: { name?: string; category?: string; description?: string }) {
    return this.adminService.updateServiceCatalogItem(id, body);
  }

  // ── PATCH /api/platform/service-catalog/rename-category ────────────────────
  // Renombra una categoría completa (afecta a todos los servicios de esa categoría).
  // IMPORTANTE: va ANTES de la ruta ":id" para que "rename-category" no se confunda
  // con un id (NestJS evalúa las rutas en orden de declaración).
  @Patch('service-catalog/rename-category')
  async renameServiceCategory(@Body() body: { oldName: string; newName: string }) {
    return this.adminService.renameServiceCategory(body.oldName, body.newName);
  }

  // ── DELETE /api/platform/service-catalog/category/:name ────────────────────
  // Borra una categoría entera del catálogo (por nombre).
  @Delete('service-catalog/category/:name')
  async deleteServiceCategory(@Param('name') name: string) {
    // decodeURIComponent() deshace la codificación de URL (ej. "%20" -> espacio),
    // porque el nombre de la categoría viaja dentro de la URL.
    return this.adminService.deleteServiceCategory(decodeURIComponent(name));
  }

  // ── DELETE /api/platform/service-catalog/:id ──────────────────────────────
  // Borra un servicio concreto del catálogo por su id.
  @Delete('service-catalog/:id')
  async deleteServiceCatalogItem(@Param('id') id: string) {
    return this.adminService.deleteServiceCatalogItem(id);
  }

  // ─── PROFESSIONS CATALOG (catálogo de profesiones / oficios) ────────────────

  // ── GET /api/platform/professions ─────────────────────────────────────────
  // Lista todas las profesiones disponibles (para asignar a empleados).
  @Get('professions')
  async getProfessions() {
    return this.adminService.getProfessions();
  }

  // ── POST /api/platform/professions ────────────────────────────────────────
  // Crea una nueva profesión. El cuerpo trae solo "name".
  @Post('professions')
  async createProfession(@Body() body: { name: string }) {
    return this.adminService.createProfession(body.name);
  }

  // ── PATCH /api/platform/professions/:id ───────────────────────────────────
  // Renombra una profesión (también actualiza los empleados que la tenían).
  @Patch('professions/:id')
  async updateProfession(@Param('id') id: string, @Body() body: { name: string }) {
    return this.adminService.updateProfession(id, body.name);
  }

  // ── DELETE /api/platform/professions/:id ──────────────────────────────────
  // Borra una profesión por su id.
  @Delete('professions/:id')
  async deleteProfession(@Param('id') id: string) {
    return this.adminService.deleteProfession(id);
  }
}
