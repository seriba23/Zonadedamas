// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: piezas que necesita este controlador.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los "decoradores" (etiquetas que empiezan con "@") para
// declarar endpoints HTTP y leer partes de la petición:
//   - Body: lee el cuerpo (JSON) que llega en un POST/PUT.
//   - Controller: marca una clase como controlador (un grupo de endpoints).
//   - Get / Post / Put: marcan un método como endpoint que responde a ese verbo.
//   - Param: lee un trozo de la URL (ej. el :id de /attendance/:id/review).
//   - Query: lee un parámetro de la query string (ej. ?startDate=2026-06-23).
//   - UseGuards: aplica "guardias" (filtros de seguridad) antes de entrar.
//   - NotFoundException: error listo para responder con HTTP 404 (no encontrado).
import { Body, Controller, Get, Param, Post, Put, Query, UseGuards, NotFoundException } from '@nestjs/common';

// El servicio con la lógica real (consultas a BD, cálculos de horas, etc.).
import { AttendanceService } from './attendance.service';

// JwtAuthGuard = guardia que exige un token JWT válido (usuario logueado).
// Si el token falta o es inválido, la petición se rechaza con 401.
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// PermissionGuard = guardia que, además de estar logueado, exige un PERMISO
// concreto (ej. "employees.update"). Se usa junto con @RequirePermissions.
import { PermissionGuard } from '../../common/guards/permission.guard';

// RequirePermissions = decorador que declara QUÉ permiso hace falta para entrar
// a un endpoint. PermissionGuard lo lee para decidir si deja pasar o no.
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

// CurrentTenant = decorador propio que extrae el "tenantId" (id del negocio) del
// token del usuario. Sirve para que cada negocio solo vea SUS datos (multi-tenant).
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

// CurrentUser = decorador propio que extrae el objeto "user" del token (quién
// está haciendo la petición). De ahí sacaremos user.userId.
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// PrismaService = el "puente" hacia la base de datos. Aquí lo usamos directo en
// un par de consultas pequeñas dentro del propio controlador.
import { PrismaService } from '../../prisma/prisma.service';

// @Controller('attendance') => todas las rutas de esta clase empiezan con
// "/api/attendance" (el prefijo "/api" se agrega globalmente en otra parte).
@Controller('attendance')
// @UseGuards(JwtAuthGuard) a nivel de CLASE => TODOS los endpoints de aquí
// exigen estar logueado (token JWT válido). Es la seguridad mínima del módulo.
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS:
  // NestJS crea e inyecta automáticamente estas dos clases. "private readonly"
  // las guarda como propiedades de solo lectura (this.attendanceService, this.prisma).
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly prisma: PrismaService,
  ) {}

  /** Admin: list attendance for a date range (filtros opcionales) */
  // ── GET /api/attendance?startDate=...&endDate=...&employeeId=...&status=... ──
  // Lista los registros de asistencia dentro de un rango de fechas. Pensado para
  // el panel del administrador (ver quién asistió, a qué hora, etc.).
  @Get()
  async findByDateRange(
    // @CurrentTenant() => inyecta el id del negocio del usuario logueado.
    @CurrentTenant() tenantId: string,
    // @Query('startDate') => lee ?startDate=YYYY-MM-DD de la URL (fecha inicio).
    @Query('startDate') startDate: string,
    // @Query('endDate') => lee ?endDate=YYYY-MM-DD (fecha fin).
    @Query('endDate') endDate: string,
    // Los dos siguientes son filtros OPCIONALES (el "?" indica que pueden faltar).
    @Query('employeeId') employeeId?: string, // filtrar por un empleado concreto
    @Query('status') status?: string,          // filtrar por estado del registro
  ) {
    // "endDate || startDate": el operador "||" devuelve el primer valor que NO
    // sea vacío/null/undefined. Si no mandaron endDate, usamos startDate como fin
    // (consultar un solo día). El resultado se guarda en "end".
    const end = endDate || startDate;
    // Delegamos al servicio pasándole el rango y los filtros opcionales.
    return this.attendanceService.findByDateRange(tenantId, startDate, end, {
      employeeId,
      status,
    });
  }

  /** Admin: count pending reviews */
  // ── GET /api/attendance/pending-count ──────────────────────────────────────
  // Devuelve cuántos registros están "PENDING_REVIEW" (pendientes de que el
  // admin los apruebe o rechace). Útil para mostrar un badge con el número.
  @Get('pending-count')
  async pendingCount(@CurrentTenant() tenantId: string) {
    // @CurrentTenant() inyecta el id del negocio. Delegamos al servicio.
    return this.attendanceService.getPendingCount(tenantId);
  }

  /** Admin: stats agregadas para el dashboard de reportes. Devuelve
   * totales por estado en el rango (presentes, completados, pendientes,
   * rechazados) y top empleados por horas trabajadas. */
  // ── GET /api/attendance/stats?startDate=...&endDate=... ───────────────────
  // Estadísticas agregadas del rango para el panel de reportes.
  @Get('stats')
  async stats(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    // Igual que antes: si no hay endDate, usamos startDate (un solo día) con "||".
    return this.attendanceService.getStats(tenantId, startDate, endDate || startDate);
  }

  /** Employee: get my attendance history */
  // ── GET /api/attendance/me/history?startDate=...&endDate=... ──────────────
  // El EMPLEADO consulta SU propio historial de asistencia. Las fechas son
  // opcionales: si no las manda, usamos los últimos 30 días por defecto.
  @Get('me/history')
  async myHistory(
    @CurrentTenant() tenantId: string,
    // @CurrentUser() inyecta el usuario logueado. "any" = no tipamos su forma.
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string, // opcional (el "?")
    @Query('endDate') endDate?: string,     // opcional
  ) {
    // El "user" es la cuenta de login; necesitamos su perfil de EMPLEADO para
    // saber su employeeId. resolveEmployee() (método privado de abajo) lo busca.
    // OJO: usamos user.userId (NO user.sub) — así viaja el id en este proyecto.
    const employee = await this.resolveEmployee(tenantId, user.userId);
    // FECHA DE INICIO por defecto: hace 30 días.
    //   - Date.now() = ahora en milisegundos.
    //   - 30 * 86400000 = 30 días en ms (86400000 ms = 1 día).
    //   - Restamos para retroceder 30 días, y .toISOString().split('T')[0]
    //     convierte la fecha a texto y se queda solo con la parte "YYYY-MM-DD"
    //     (split('T') parte en la "T", y [0] toma lo de antes: la fecha).
    //   - El "||" hace que solo se calcule esto si NO mandaron startDate.
    const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    // FECHA DE FIN por defecto: hoy (misma técnica para sacar "YYYY-MM-DD").
    const end = endDate || new Date().toISOString().split('T')[0];
    // Buscamos los registros del empleado en ese rango. findMany = "trae varios".
    const records = await this.prisma.attendance.findMany({
      // where = condiciones. Filtramos por empleado, por negocio (multi-tenant) y
      // por fecha entre el inicio (00:00:00) y el fin (23:59:59).
      //   - gte = "mayor o igual que" (>=).
      //   - lte = "menor o igual que" (<=).
      // Pegamos 'T00:00:00Z'/'T23:59:59Z' para abarcar el día completo en UTC.
      where: { employeeId: employee.id, tenantId, date: { gte: new Date(start + 'T00:00:00Z'), lte: new Date(end + 'T23:59:59Z') } },
      // orderBy date 'desc' = ordenar por fecha de la más reciente a la más antigua.
      orderBy: { date: 'desc' },
    });
    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data: records };
  }

  /** Employee: get my attendance today */
  // ── GET /api/attendance/me/today ──────────────────────────────────────────
  // El empleado consulta SU registro de asistencia de HOY (para saber si ya
  // marcó entrada/salida). Devuelve el registro o null si aún no marca nada.
  @Get('me/today')
  async myToday(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    // Resolvemos el perfil de empleado a partir del usuario logueado.
    const employee = await this.resolveEmployee(tenantId, user.userId);
    // Delegamos al servicio, que buscará el registro de hoy de este empleado.
    return this.attendanceService.getMyAttendanceToday(tenantId, employee.id);
  }

  /** Employee: check in */
  // ── POST /api/attendance/check-in ─────────────────────────────────────────
  // El empleado MARCA SU ENTRADA. Envía su ubicación (GPS) para verificar que
  // está físicamente en el negocio. El servicio calcula la distancia.
  @Post('check-in')
  async checkIn(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    // @Body() lee el JSON enviado. Esperamos latitud y longitud (números) y un
    // "forceOutOfRange" opcional: si es true, el empleado fuerza el registro
    // aunque esté fuera del rango permitido (quedará pendiente de revisión).
    @Body() body: { latitude: number; longitude: number; forceOutOfRange?: boolean },
  ) {
    // Resolvemos su perfil de empleado (usando user.userId, no user.sub).
    const employee = await this.resolveEmployee(tenantId, user.userId);
    // Delegamos al servicio toda la lógica (distancia, validación, crear registro).
    return this.attendanceService.checkIn(
      tenantId, employee.id, body.latitude, body.longitude, body.forceOutOfRange,
    );
  }

  /** Employee: check out */
  // ── POST /api/attendance/check-out ────────────────────────────────────────
  // El empleado MARCA SU SALIDA (cierra la jornada del día). Mismo patrón que
  // check-in: manda ubicación y opcionalmente fuerza si está fuera de rango.
  @Post('check-out')
  async checkOut(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { latitude: number; longitude: number; forceOutOfRange?: boolean },
  ) {
    const employee = await this.resolveEmployee(tenantId, user.userId);
    return this.attendanceService.checkOut(
      tenantId, employee.id, body.latitude, body.longitude, body.forceOutOfRange,
    );
  }

  /** Admin: approve or reject attendance */
  // ── PUT /api/attendance/:id/review ────────────────────────────────────────
  // El ADMIN aprueba o rechaza un registro de asistencia (típicamente los que
  // quedaron PENDING_REVIEW por estar fuera de rango).
  @Put(':id/review')
  // Además del login (guardia de clase), este endpoint exige PERMISO concreto:
  // @UseGuards(PermissionGuard) activa la verificación de permisos, y
  // @RequirePermissions('employees.update') dice CUÁL permiso hace falta.
  @UseGuards(PermissionGuard)
  @RequirePermissions('employees.update')
  async review(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    // @Param('id') => toma el :id de la URL (qué registro se está revisando).
    @Param('id') id: string,
    // El cuerpo trae el nuevo estado: solo puede ser 'APPROVED' o 'REJECTED'
    // (el tipo lo limita a esos dos valores exactos).
    @Body() body: { status: 'APPROVED' | 'REJECTED' },
  ) {
    // Pasamos también user.userId para registrar QUIÉN hizo la revisión.
    return this.attendanceService.reviewAttendance(id, tenantId, body.status, user.userId);
  }

  // ── MÉTODO PRIVADO AUXILIAR (no es un endpoint) ───────────────────────────
  // resolveEmployee: a partir del usuario logueado (userId) busca su perfil de
  // EMPLEADO dentro del negocio. Se reutiliza en varios endpoints de arriba.
  private async resolveEmployee(tenantId: string, userId: string) {
    // findFirst = "trae el primer registro que cumpla". Buscamos un empleado que
    // pertenezca a este usuario, a este negocio (tenant) y que esté activo.
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId, isActive: true },
    });
    // "!employee" = "si NO hay empleado". Si el usuario no tiene perfil de
    // empleado asociado, no puede usar asistencia -> error 404.
    if (!employee) {
      throw new NotFoundException('No tienes un perfil de empleado asociado.');
    }
    // Si lo encontramos, lo devolvemos para que el endpoint use employee.id.
    return employee;
  }
}
