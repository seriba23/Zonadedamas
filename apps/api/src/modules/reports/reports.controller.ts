// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos "piezas" de NestJS y del propio proyecto para armar los
// endpoints de reportes (las URLs que el dashboard del negocio consulta).
// ─────────────────────────────────────────────────────────────────────────────

// Decoradores (etiquetas "@") de NestJS para declarar endpoints HTTP:
//   - Controller: marca la clase como "controlador" (un grupo de endpoints).
//   - Get: marca un método como endpoint que responde a peticiones HTTP GET.
//   - Query: lee un parámetro de la query string de la URL (ej. ?startDate=...).
//   - Req: da acceso al objeto "request" (la petición entera). Lo usamos para
//     leer el usuario autenticado que el guard de JWT deja dentro (req.user).
//   - UseGuards: aplica "guardias" que protegen los endpoints (validan login y
//     permisos antes de dejar pasar la petición).
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';

// El servicio con la lógica real de los reportes (cálculos y consultas a la BD).
import { ReportsService } from './reports.service';

// JwtAuthGuard: guardia que comprueba que la petición trae un token JWT válido
// (es decir, que el usuario inició sesión). Si no, responde 401 (no autorizado).
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// PermissionGuard: guardia que comprueba que el usuario tenga el permiso exigido
// para ese endpoint. Si no lo tiene, responde 403 (prohibido).
import { PermissionGuard } from '../../common/guards/permission.guard';

// RequirePermissions: decorador que DECLARA qué permiso necesita un endpoint.
// El PermissionGuard de arriba lee esa declaración para decidir si deja pasar.
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

// @Controller('reports') => todas las rutas de esta clase empiezan con
// "/api/reports". (El prefijo "/api" se agrega globalmente en otra parte.)
// Así, un método con @Get('dashboard') responde a GET /api/reports/dashboard.
@Controller('reports')
// @UseGuards aplica DOS guardias a TODOS los endpoints de esta clase, en orden:
//   1) JwtAuthGuard: ¿hay sesión válida? 2) PermissionGuard: ¿tiene el permiso?
// Solo si ambas pasan se ejecuta el método del endpoint.
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportsController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS:
  // NestJS crea una instancia de ReportsService y nos la "inyecta" aquí.
  // "private readonly" la guarda como propiedad (this.reportsService) de solo
  // lectura, lista para usar en todos los métodos de abajo.
  constructor(private readonly reportsService: ReportsService) {}

  // ── GET /api/reports/dashboard ────────────────────────────────────────────
  // Reporte principal del dashboard: KPIs, ingresos por día, top servicios,
  // top empleados, métodos de pago, métricas de clientes y actividad reciente.
  @Get('dashboard')
  // El usuario debe tener el permiso "reports.revenue" para ver este reporte.
  @RequirePermissions('reports.revenue')
  async getDashboardReport(
    // @Req() da acceso a la petición; de ahí sacamos req.user.tenantId (el
    // negocio del usuario logueado) para filtrar SIEMPRE por ese tenant.
    @Req() req: any,
    // @Query('startDate') lee ?startDate=YYYY-MM-DD de la URL (puede venir vacío).
    @Query('startDate') startDate: string,
    // @Query('endDate') lee ?endDate=YYYY-MM-DD de la URL (puede venir vacío).
    @Query('endDate') endDate: string,
  ) {
    // Si no mandan fechas, usamos por defecto el mes en curso.
    // new Date() = el instante actual (fecha y hora de "ahora").
    const now = new Date();
    // "start": fecha de inicio.
    //   - "startDate || ..." => el operador "||" usa lo de la IZQUIERDA si tiene
    //     valor; si startDate viene vacío/undefined, usa lo de la DERECHA.
    //   - Lo de la derecha construye el primer día del mes actual:
    //       now.getFullYear() = el año (ej. 2026).
    //       now.getMonth() = el mes pero EMPEZANDO EN 0 (enero=0), por eso "+1".
    //       String(...).padStart(2, '0') => convierte a texto y rellena con un
    //       "0" a la izquierda si hace falta (ej. 6 -> "06"), para tener "MM".
    //     Resultado: "2026-06-01".
    const start = startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    // "end": fecha de fin. Si no la mandan, usamos HOY.
    //   - now.toISOString() => fecha-hora completa estándar ("2026-06-24T...Z").
    //   - .split('T')[0] => parte el texto por la "T" y toma el primer trozo,
    //     quedándonos solo con la parte de la fecha "2026-06-24" (sin la hora).
    const end = endDate || now.toISOString().split('T')[0];

    // Pedimos el reporte al servicio. "await" = espera a que termine (consulta
    // a la BD, que tarda) antes de seguir. Le pasamos el tenant y el rango.
    const data = await this.reportsService.getDashboardReport(req.user.tenantId, start, end);
    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data };
  }

  // ── GET /api/reports/sales-breakdown ──────────────────────────────────────
  // Desglose de la "Venta Total" del período: servicios | paquetes | productos.
  @Get('sales-breakdown')
  @RequirePermissions('reports.revenue')
  async getSalesBreakdown(
    @Req() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    // Mismo cálculo de fechas por defecto que en getDashboardReport (mes actual).
    const now = new Date();
    const start = startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const end = endDate || now.toISOString().split('T')[0];
    // Delegamos el cálculo al servicio y devolvemos el resultado envuelto.
    const data = await this.reportsService.getSalesBreakdown(req.user.tenantId, start, end);
    return { data };
  }

  // ── GET /api/reports/today ────────────────────────────────────────────────
  // Resumen del día de hoy (y del mes): citas, ingresos, próximas citas, etc.
  // No recibe fechas: el servicio calcula "hoy" internamente.
  @Get('today')
  @RequirePermissions('reports.revenue')
  async getTodaySummary(@Req() req: any) {
    const data = await this.reportsService.getTodaySummary(req.user.tenantId);
    return { data };
  }

  // ── GET /api/reports/alerts ───────────────────────────────────────────────
  // Conteos para los "badges" de alerta del dashboard: stock bajo, reservas
  // pendientes y citas sin confirmar.
  @Get('alerts')
  @RequirePermissions('reports.revenue')
  async getAlerts(@Req() req: any) {
    const data = await this.reportsService.getAlertCounts(req.user.tenantId);
    return { data };
  }
}
