// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
// De NestJS importamos los "decoradores" (etiquetas "@") para construir endpoints:
//   - Body: lee el cuerpo JSON enviado en la petición.
//   - Controller: marca la clase como un grupo de endpoints.
//   - Delete / Get / Patch / Post / Put: marcan un método como endpoint del
//     verbo HTTP correspondiente (borrar, leer, actualizar parcial, crear, reemplazar).
//   - Param: lee un trozo de la URL (ej. el :id de /employees/:id).
//   - Query: lee parámetros de la query string (ej. ?locationId=...).
//   - UseGuards: aplica "guardias" que protegen el endpoint (auth/permisos).
//   - UseInterceptors: aplica "interceptores" (aquí, para recibir archivos).
//   - UploadedFile: extrae el archivo subido del request.
//   - BadRequestException: error listo para responder HTTP 400.
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
// FileInterceptor: interceptor de NestJS que procesa la subida de UN archivo
// (campo "file" de un formulario multipart) y lo deja disponible vía @UploadedFile.
import { FileInterceptor } from '@nestjs/platform-express';
// El servicio con la lógica de negocio de empleados.
import { EmployeesService } from './employees.service';
// DTOs (formas de datos) que validan los cuerpos de cada petición:
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { SetSchedulesDto } from './dto/schedule.dto';
import { CreateTimeOffDto, RejectTimeOffDto, SetServicesDto } from './dto/time-off.dto';
import { CreatePortfolioImageDto } from './dto/portfolio.dto';
import { UpdatePersonalInfoDto } from './dto/personal-info.dto';
import { CreateDocumentDto } from './dto/document.dto';
import { CreateTrainingDto } from './dto/training.dto';
import { DeactivateEmployeeDto } from './dto/deactivate-employee.dto';
// JwtAuthGuard: guardia que exige un token JWT válido (usuario autenticado).
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// PermissionGuard: guardia que comprueba que el usuario tenga el permiso pedido.
import { PermissionGuard } from '../../common/guards/permission.guard';
// RequirePermissions: decorador que declara qué permiso exige cada endpoint.
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
// CurrentTenant: decorador que extrae el tenantId (negocio) del token JWT.
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
// CurrentUser: decorador que extrae el usuario actual del JWT. JwtPayload es el
// "tipo" (forma) de ese usuario (contiene userId, etc.).
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
// PaginationDto: DTO base con page/perPage para listados paginados.
import { PaginationDto } from '../../common/dto/pagination.dto';
// UploadsService: servicio que guarda/borra archivos físicos (avatares, docs...).
import { UploadsService } from '../uploads/uploads.service';
// PrismaService: puente directo a la base de datos (se usa en algunos endpoints).
import { PrismaService } from '../../prisma/prisma.service';
// Validadores usados en los DTOs locales declarados más abajo.
import { IsDateString, IsOptional, IsString } from 'class-validator';

// MulterFile: describe la "forma" de un archivo subido (multer). No es un DTO de
// validación, solo un tipo para tener autocompletado y tipado del archivo.
interface MulterFile {
  fieldname: string;   // nombre del campo del formulario ("file")
  originalname: string; // nombre original del archivo en el equipo del usuario
  encoding: string;     // codificación de transferencia
  mimetype: string;     // tipo MIME (ej. "image/png")
  size: number;         // tamaño en bytes
  buffer: Buffer;       // el contenido binario del archivo en memoria
}

// DTO para los parámetros de la query string al LISTAR empleados. Extiende
// PaginationDto, así que hereda page/perPage y añade filtros propios.
class EmployeeQueryDto extends PaginationDto {
  // locationId: filtrar por sucursal. Opcional, texto.
  @IsOptional()
  @IsString()
  locationId?: string;

  // includeInactive: viene como texto ("true"/"false") porque la query string
  // siempre es texto. Opcional.
  @IsOptional()
  @IsString()
  includeInactive?: string;

  @IsOptional()
  @IsString()
  workingDate?: string; // YYYY-MM-DD — filter employees who work on this date
}

// DTO para la query string al pedir TODOS los tiempos libres en un rango.
class TimeOffQueryDto {
  // startDate / endDate: límites del rango. Obligatorios, fecha ISO.
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  // status: filtro opcional por estado (PENDING/APPROVED/REJECTED).
  @IsOptional()
  @IsString()
  status?: string;
}

// DTO para la query string al pedir los tiempos libres de UN empleado.
class EmployeeTimeOffQueryDto {
  // status: filtro opcional por estado.
  @IsOptional()
  @IsString()
  status?: string;
}

// @Controller('employees') => todas las rutas de esta clase cuelgan de
// "/api/employees" (el prefijo "/api" se añade globalmente en otra parte).
@Controller('employees')
// @UseGuards(...) a nivel de clase aplica DOS guardias a TODOS los endpoints:
//   1) JwtAuthGuard: exige estar autenticado (token JWT válido).
//   2) PermissionGuard: comprueba el permiso que cada método declare con
//      @RequirePermissions. (Los métodos sin @RequirePermissions solo exigen JWT.)
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeesController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS: NestJS crea e inyecta estas tres
  // clases. "private readonly" las guarda como propiedades de solo lectura:
  //   - employeesService: lógica de negocio de empleados.
  //   - uploadsService: guardar/borrar archivos (avatares, portadas, docs...).
  //   - prisma: acceso directo a la BD para operaciones puntuales.
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly uploadsService: UploadsService,
    private readonly prisma: PrismaService,
  ) {}

  // ── GET /api/employees ────────────────────────────────────────────────────
  // Lista los empleados del negocio (paginado y con filtros opcionales).
  @Get()
  @RequirePermissions('employees.read') // exige el permiso "employees.read"
  async findAll(
    @CurrentTenant() tenantId: string,       // negocio actual (del JWT)
    @Query() query: EmployeeQueryDto,        // filtros de la query string
  ) {
    // Delega en el servicio. "query.includeInactive === 'true'" convierte el
    // texto de la query en un booleano: solo es true si llegó exactamente "true".
    return this.employeesService.findAll(tenantId, query, query.locationId, query.includeInactive === 'true', query.workingDate);
  }

  // ── GET /api/employees/time-offs ──────────────────────────────────────────
  // Lista TODOS los tiempos libres del negocio dentro de un rango de fechas.
  @Get('time-offs')
  @RequirePermissions('employees.read')
  async getAllTimeOffs(
    @CurrentTenant() tenantId: string,
    @Query() query: TimeOffQueryDto,
  ) {
    const timeOffs = await this.employeesService.getAllTimeOffs(
      tenantId,
      query.startDate,
      query.endDate,
      query.status,
    );
    // Respuesta con el formato estándar del proyecto: { data: ... }.
    return { data: timeOffs };
  }

  // ── GET /api/employees/time-off-requests ───────────────────────────────────
  // Solicitudes de permiso del negocio para la pantalla de aprobación del admin
  // (sin rango de fechas; opcionalmente filtradas por ?status=PENDING).
  @Get('time-off-requests')
  @RequirePermissions('employees.read')
  async getTimeOffRequests(
    @CurrentTenant() tenantId: string,
    @Query('status') status?: string,
  ) {
    const requests = await this.employeesService.getTimeOffRequests(tenantId, status);
    return { data: requests };
  }

  // ── POST /api/employees ───────────────────────────────────────────────────
  // Crea un nuevo empleado.
  @Post()
  @RequirePermissions('employees.create')
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateEmployeeDto, // datos validados por CreateEmployeeDto
  ) {
    const employee = await this.employeesService.create(tenantId, dto);
    return { data: employee };
  }

  // ── GET /api/employees/:id/pending-appointments-count ─────────────────────
  // Cuenta cuántas citas futuras pendientes tiene el empleado (útil antes de
  // desactivarlo, para advertir al admin). Exige permiso de borrado.
  @Get(':id/pending-appointments-count')
  @RequirePermissions('employees.delete')
  async getPendingAppointmentsCount(
    @Param('id') id: string,           // :id del empleado en la URL
    @CurrentTenant() tenantId: string,
  ) {
    const count = await this.employeesService.countPendingAppointments(id, tenantId);
    return { data: { count } };
  }

  // ── POST /api/employees/:id/deactivate ────────────────────────────────────
  // Desactiva un empleado aplicando la estrategia elegida en el body
  // (smart_reschedule / reassign / cancel / keep).
  @Post(':id/deactivate')
  @RequirePermissions('employees.delete')
  async deactivate(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,        // usuario que ejecuta la acción
    @Body() dto: DeactivateEmployeeDto,     // qué estrategia usar
  ) {
    // user.userId se pasa para registrar quién hizo la desactivación (auditoría).
    const result = await this.employeesService.deactivate(id, tenantId, dto, user.userId);
    return { data: result };
  }

  // ── POST /api/employees/:id/finalize-deactivation ─────────────────────────
  // Cierra una desactivación que había quedado pendiente por conflictos de
  // citas (ya resueltos): ahora sí marca al empleado como inactivo.
  @Post(':id/finalize-deactivation')
  @RequirePermissions('employees.delete')
  async finalizeDeactivation(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.employeesService.finalizeDeactivation(id, tenantId, user.userId);
    return { data: result };
  }

  // ── GET /api/employees/me ─────────────────────────────────────────────────
  // Versiones SELF (el propio empleado logueado) de findOne/getStats/getReviews.
  // No exigen 'employees.read': un empleado siempre puede ver SUS propios datos.
  // Deben declararse ANTES de @Get(':id') para que Nest no capture 'me' como :id.
  @Get('me')
  async findMe(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
  ) {
    const emp = await this.employeesService.findByUserId(user.userId, tenantId);
    const employee = await this.employeesService.findOne(emp.id, tenantId);
    return { data: employee };
  }

  // ── GET /api/employees/me/stats ───────────────────────────────────────────
  @Get('me/stats')
  async getMyStats(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
  ) {
    const emp = await this.employeesService.findByUserId(user.userId, tenantId);
    const stats = await this.employeesService.getStats(emp.id, tenantId);
    return { data: stats };
  }

  // ── GET /api/employees/me/reviews ─────────────────────────────────────────
  @Get('me/reviews')
  async getMyReviews(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
  ) {
    const emp = await this.employeesService.findByUserId(user.userId, tenantId);
    const result = await this.employeesService.getReviews(emp.id, tenantId);
    return { data: result };
  }

  // ── GET /api/employees/:id ────────────────────────────────────────────────
  // Devuelve el detalle de UN empleado.
  @Get(':id')
  @RequirePermissions('employees.read')
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const employee = await this.employeesService.findOne(id, tenantId);
    return { data: employee };
  }

  // Admin access: grant/revoke admin modules to employee
  // ── POST /api/employees/:id/admin-access ──────────────────────────────────
  // Otorga al empleado acceso a ciertos módulos de administración, creando o
  // actualizando un rol "Ayudante" con los permisos de esos módulos.
  // Exige el permiso "roles.update" (gestionar roles).
  @Post(':id/admin-access')
  @RequirePermissions('roles.update')
  async grantAdminAccess(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() body: { modules: string[] },   // lista de módulos a conceder
  ) {
    // Cargamos el empleado (también valida que pertenezca al tenant).
    const employee = await this.employeesService.findOne(id, tenantId);
    // "!employee.userId" = "si el empleado NO tiene cuenta de usuario": sin
    // cuenta no se le pueden asignar roles -> error 400.
    if (!employee.userId) throw new BadRequestException('Empleado sin cuenta de usuario');

    // Get all permissions for the selected modules.
    // Algunos módulos de la UI son "virtuales": no son un módulo de permisos
    // real, sino un acceso concreto. 'reminders' (Recordatorios) concede
    // appointments.read (para ver la agenda de recordatorios) + appointments.remind
    // (el permiso propio que gobierna /reminders y sus endpoints, separado de
    // Calendario para no acoplar ambas secciones).
    const VIRTUAL_MODULE_PERMS: Record<string, Array<{ module: string; action: string }>> = {
      reminders: [
        { module: 'appointments', action: 'read' },
        { module: 'appointments', action: 'remind' },
      ],
    };
    const realModules = body.modules.filter((m) => !VIRTUAL_MODULE_PERMS[m]);
    const virtualPairs = body.modules.flatMap((m) => VIRTUAL_MODULE_PERMS[m] || []);
    // Trae los permisos de los módulos reales + los pares concretos de los virtuales.
    const permissions = await this.prisma.permission.findMany({
      where: {
        OR: [
          ...(realModules.length ? [{ module: { in: realModules } }] : []),
          ...virtualPairs.map((v) => ({ module: v.module, action: v.action })),
        ],
      },
    });

    // Find or create "Ayudante" role for this tenant
    // "let" (no const) porque puede que tengamos que reasignarla más abajo.
    // Busca el rol "Ayudante" de este negocio (puede existir o no -> null).
    let helperRole = await this.prisma.role.findFirst({
      where: { tenantId, name: 'Ayudante' },
    });

    // Si el rol ya existe, borramos sus permisos actuales para regenerarlos;
    // si no, lo creamos desde cero.
    if (helperRole) {
      // Clear existing permissions
      await this.prisma.rolePermission.deleteMany({ where: { roleId: helperRole.id } });
    } else {
      helperRole = await this.prisma.role.create({
        data: { tenantId, name: 'Ayudante', slug: 'helper', description: 'Acceso parcial a la administracion' },
      });
    }

    // Assign new permissions
    // Solo si hay permisos que asignar (length > 0).
    if (permissions.length > 0) {
      await this.prisma.rolePermission.createMany({
        // map() recorre cada permiso "p" y construye el vínculo rol↔permiso.
        // helperRole! usa "!" (non-null assertion) para afirmarle a TypeScript
        // que helperRole ya no es null en este punto.
        data: permissions.map((p) => ({ roleId: helperRole!.id, permissionId: p.id })),
        // skipDuplicates evita errores si un vínculo ya existiera.
        skipDuplicates: true,
      });
    }

    // Assign role to user if not already
    // Comprobamos si el usuario ya tiene asignado ese rol, para no duplicarlo.
    const existing = await this.prisma.userRole.findFirst({
      where: { userId: employee.userId, roleId: helperRole.id, tenantId },
    });
    // "!existing" = "si NO existía ya el vínculo": entonces lo creamos.
    if (!existing) {
      await this.prisma.userRole.create({
        // employee.userId! con "!" porque arriba ya garantizamos que no es null.
        data: { userId: employee.userId!, roleId: helperRole.id, tenantId },
      });
    }

    return { data: { message: 'Acceso de administrador actualizado' } };
  }

  // ── DELETE /api/employees/:id/admin-access ────────────────────────────────
  // Revoca el acceso admin: quita al usuario el rol "Ayudante".
  @Delete(':id/admin-access')
  @RequirePermissions('roles.update')
  async revokeAdminAccess(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const employee = await this.employeesService.findOne(id, tenantId);
    // Si el empleado no tiene cuenta, no hay nada que revocar: respondemos "OK".
    if (!employee.userId) return { data: { message: 'OK' } };

    // Buscamos el rol "Ayudante" del negocio.
    const helperRole = await this.prisma.role.findFirst({
      where: { tenantId, name: 'Ayudante' },
    });
    // Si el rol existe, borramos el vínculo usuario↔rol (deja de tener acceso).
    if (helperRole) {
      await this.prisma.userRole.deleteMany({
        where: { userId: employee.userId, roleId: helperRole.id, tenantId },
      });
    }

    return { data: { message: 'Acceso de administrador revocado' } };
  }

  // Self-edit: employee updates their own profile (no employees.update needed)
  // ── PUT /api/employees/me ─────────────────────────────────────────────────
  // El propio empleado edita SU perfil. Nótese que NO lleva @RequirePermissions:
  // como solo edita lo suyo, basta con estar autenticado (JwtAuthGuard).
  @Put('me')
  async updateMe(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    // Primero localizamos el registro de empleado a partir del userId del JWT
    // (un usuario logueado puede no saber su employeeId, pero sí su userId).
    const emp = await this.employeesService.findByUserId(user.userId, tenantId);
    const employee = await this.employeesService.update(emp.id, tenantId, dto);
    return { data: employee };
  }

  // ── PUT /api/employees/me/personal-info ───────────────────────────────────
  // El empleado actualiza su propia info personal/médica (sin permiso especial).
  @Put('me/personal-info')
  async updateMyPersonalInfo(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdatePersonalInfoDto,
  ) {
    const emp = await this.employeesService.findByUserId(user.userId, tenantId);
    const employee = await this.employeesService.updatePersonalInfo(emp.id, tenantId, dto);
    return { data: employee };
  }

  // ── COMISIONES (empleado) ──────────────────────────────────────────────────
  // GET /api/employees/me/commission-summary → devengado, cobrado, por cobrar y
  // los pagos pendientes de confirmar.
  @Get('me/commission-summary')
  async myCommissionSummary(@CurrentUser() user: JwtPayload, @CurrentTenant() tenantId: string) {
    const emp = await this.employeesService.findByUserId(user.userId, tenantId);
    return this.employeesService.getMyCommissionSummary(emp.id, tenantId);
  }

  // POST /api/employees/me/commission-payments/:paymentId/confirm → el empleado
  // confirma que recibió el pago.
  @Post('me/commission-payments/:paymentId/confirm')
  async confirmMyCommissionPayment(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('paymentId') paymentId: string,
  ) {
    const emp = await this.employeesService.findByUserId(user.userId, tenantId);
    return this.employeesService.confirmCommissionPayment(paymentId, emp.id, tenantId);
  }

  // POST /api/employees/me/commission-payments/:paymentId/dispute → el empleado
  // indica que NO recibió el pago (queda en disputa).
  @Post('me/commission-payments/:paymentId/dispute')
  async disputeMyCommissionPayment(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Param('paymentId') paymentId: string,
  ) {
    const emp = await this.employeesService.findByUserId(user.userId, tenantId);
    return this.employeesService.disputeCommissionPayment(paymentId, emp.id, tenantId);
  }

  // ── COMISIONES (admin) ─────────────────────────────────────────────────────
  // POST /api/employees/:id/commission-payments → el admin registra un pago de
  // comisión a un empleado (queda pendiente de confirmación del empleado).
  @Post(':id/commission-payments')
  @RequirePermissions('employees.update')
  async createCommissionPayment(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: { amount: number; note?: string },
  ) {
    return this.employeesService.createCommissionPayment(id, tenantId, dto, user.userId);
  }

  // GET /api/employees/:id/commission-payments → historial + resumen (admin).
  @Get(':id/commission-payments')
  @RequirePermissions('employees.read')
  async listCommissionPayments(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.employeesService.listCommissionPayments(id, tenantId);
  }

  // Self-service: employee requests their own time off
  // ── GET /api/employees/me/time-off ────────────────────────────────────────
  // El empleado consulta sus propias solicitudes de tiempo libre.
  @Get('me/time-off')
  async getMyTimeOff(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
  ) {
    const emp = await this.employeesService.findByUserId(user.userId, tenantId);
    const timeOff = await this.employeesService.getTimeOff(emp.id, tenantId);
    return { data: timeOff };
  }

  // ── POST /api/employees/me/time-off ───────────────────────────────────────
  // El empleado solicita tiempo libre para sí mismo.
  @Post('me/time-off')
  async requestTimeOff(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateTimeOffDto,
  ) {
    const emp = await this.employeesService.findByUserId(user.userId, tenantId);
    // Forzamos status PENDING: una autosolicitud SIEMPRE queda pendiente de
    // aprobación (el empleado no puede auto-aprobarse).
    dto.status = 'PENDING'; // Always pending when self-requested
    const timeOff = await this.employeesService.addTimeOff(emp.id, tenantId, dto);
    return { data: timeOff };
  }

  // ── PUT /api/employees/:id ────────────────────────────────────────────────
  // Un admin edita a CUALQUIER empleado. Aquí sí se exige "employees.update".
  // (Va después de las rutas "me" para que "me" no se confunda con un :id.)
  @Put(':id')
  @RequirePermissions('employees.update')
  async update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const employee = await this.employeesService.update(id, tenantId, dto);
    return { data: employee };
  }

  // ── DELETE /api/employees/:id ─────────────────────────────────────────────
  // "Borrado" lógico: en realidad desactiva al empleado (no lo elimina de la BD).
  @Delete(':id')
  @RequirePermissions('employees.delete')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.employeesService.remove(id, tenantId);
    return { data: result };
  }

  // ── GET /api/employees/:id/stats ──────────────────────────────────────────
  // Devuelve estadísticas del empleado (citas, ingresos, comisiones, rating...).
  @Get(':id/stats')
  @RequirePermissions('employees.read')
  async getStats(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const stats = await this.employeesService.getStats(id, tenantId);
    return { data: stats };
  }

  // ── GET /api/employees/:id/schedules ──────────────────────────────────────
  // Devuelve el horario semanal del empleado.
  @Get(':id/schedules')
  @RequirePermissions('employees.read')
  async getSchedules(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const schedules = await this.employeesService.getSchedules(id, tenantId);
    return { data: schedules };
  }

  // ── PUT /api/employees/:id/schedules ──────────────────────────────────────
  // Reemplaza el horario completo del empleado. Exige el permiso específico
  // "employees.manage_schedule".
  @Put(':id/schedules')
  @RequirePermissions('employees.manage_schedule')
  async setSchedules(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: SetSchedulesDto,
  ) {
    const schedules = await this.employeesService.setSchedules(id, tenantId, dto);
    return { data: schedules };
  }

  // ── GET /api/employees/:id/time-off ───────────────────────────────────────
  // Lista los tiempos libres de un empleado (con filtro opcional por estado).
  @Get(':id/time-off')
  @RequirePermissions('employees.read')
  async getTimeOff(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Query() query: EmployeeTimeOffQueryDto,
  ) {
    const timeOff = await this.employeesService.getTimeOff(id, tenantId, query.status);
    return { data: timeOff };
  }

  // ── POST /api/employees/:id/time-off ──────────────────────────────────────
  // Un admin/gestor añade tiempo libre a un empleado. Exige permiso específico.
  @Post(':id/time-off')
  @RequirePermissions('employees.manage_time_off')
  async addTimeOff(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateTimeOffDto,
  ) {
    const timeOff = await this.employeesService.addTimeOff(id, tenantId, dto);
    return { data: timeOff };
  }

  // ── DELETE /api/employees/:id/time-off/:timeOffId ─────────────────────────
  // Elimina un registro de tiempo libre concreto.
  @Delete(':id/time-off/:timeOffId')
  @RequirePermissions('employees.manage_time_off')
  async removeTimeOff(
    @Param('id') id: string,
    @Param('timeOffId') timeOffId: string, // :timeOffId = el registro a borrar
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.employeesService.removeTimeOff(id, tenantId, timeOffId);
    return { data: result };
  }

  // ── PUT /api/employees/:id/time-off/:timeOffId/approve ────────────────────
  // Aprueba una solicitud de tiempo libre pendiente.
  @Put(':id/time-off/:timeOffId/approve')
  @RequirePermissions('employees.update')
  async approveTimeOff(
    @Param('id') id: string,
    @Param('timeOffId') timeOffId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,        // quién aprueba (queda registrado)
  ) {
    const timeOff = await this.employeesService.approveTimeOff(tenantId, id, timeOffId, user.userId);
    return { data: timeOff };
  }

  // ── PUT /api/employees/:id/time-off/:timeOffId/reject ─────────────────────
  // Rechaza una solicitud de tiempo libre, con un motivo obligatorio.
  @Put(':id/time-off/:timeOffId/reject')
  @RequirePermissions('employees.update')
  async rejectTimeOff(
    @Param('id') id: string,
    @Param('timeOffId') timeOffId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RejectTimeOffDto,          // trae rejectionReason
  ) {
    const timeOff = await this.employeesService.rejectTimeOff(tenantId, id, timeOffId, user.userId, dto.rejectionReason);
    return { data: timeOff };
  }

  // ── GET /api/employees/:id/services ───────────────────────────────────────
  // Lista los servicios que ofrece el empleado (con precio/comisión propios).
  @Get(':id/services')
  @RequirePermissions('employees.read')
  async getServices(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const services = await this.employeesService.getServices(id, tenantId);
    return { data: services };
  }

  // ── PUT /api/employees/:id/services ───────────────────────────────────────
  // Reemplaza la lista de servicios del empleado. Exige "employees.manage_services".
  @Put(':id/services')
  @RequirePermissions('employees.manage_services')
  async setServices(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: SetServicesDto,
  ) {
    const services = await this.employeesService.setServices(
      id,
      tenantId,
      dto.services,
    );
    return { data: services };
  }

  // ─── AVATAR & COVER ────────────────────────────────

  // Self-upload: employee uploads their own cover image
  // ── POST /api/employees/me/cover ──────────────────────────────────────────
  // El empleado sube su propia foto de portada.
  // @UseInterceptors(FileInterceptor('file', ...)) procesa el archivo del campo
  // "file"; "limits.fileSize: 5 * 1024 * 1024" = 5 MB máximo (en bytes).
  @Post('me/cover')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadMyCover(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: MulterFile,       // el archivo subido
  ) {
    const employee = await this.employeesService.findByUserId(user.userId, tenantId);
    // Guardamos la URL anterior para borrar ese archivo viejo al final.
    const oldCoverUrl = employee.coverImageUrl;
    // Guardamos el archivo nuevo en la carpeta 'avatars' y obtenemos su URL.
    const imageUrl = await this.uploadsService.saveFile(file, 'avatars');
    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: { coverImageUrl: imageUrl },
    });
    // Si había una portada previa, la borramos para no dejar basura en disco.
    if (oldCoverUrl) {
      await this.uploadsService.deleteFile(oldCoverUrl);
    }
    return { data: updated };
  }

  // Self-upload: employee uploads their own avatar (no employees.update needed)
  // ── POST /api/employees/me/avatar ─────────────────────────────────────────
  // El empleado sube su propia foto de perfil (avatar).
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadMyAvatar(
    @CurrentUser() user: JwtPayload,
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: MulterFile,
  ) {
    const employee = await this.employeesService.findByUserId(user.userId, tenantId);
    const oldAvatarUrl = employee.avatarUrl;
    const imageUrl = await this.uploadsService.saveFile(file, 'avatars');
    const updated = await this.employeesService.updateAvatar(employee.id, tenantId, imageUrl);
    // Borrado del avatar antiguo (si existía).
    if (oldAvatarUrl) {
      await this.uploadsService.deleteFile(oldAvatarUrl);
    }
    return { data: updated };
  }

  // ── POST /api/employees/:id/avatar ────────────────────────────────────────
  // Un admin sube el avatar de OTRO empleado. Aquí sí exige "employees.update".
  @Post(':id/avatar')
  @RequirePermissions('employees.update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAvatar(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: MulterFile,
  ) {
    const employee = await this.employeesService.findOne(id, tenantId);
    const oldAvatarUrl = employee.avatarUrl;
    const imageUrl = await this.uploadsService.saveFile(file, 'avatars');
    const updated = await this.employeesService.updateAvatar(id, tenantId, imageUrl);
    if (oldAvatarUrl) {
      await this.uploadsService.deleteFile(oldAvatarUrl);
    }
    return { data: updated };
  }

  // Admin: subir / cambiar foto de portada de cualquier empleado del tenant.
  // ── POST /api/employees/:id/cover ─────────────────────────────────────────
  @Post(':id/cover')
  @RequirePermissions('employees.update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadCover(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: MulterFile,
  ) {
    const employee = await this.employeesService.findOne(id, tenantId);
    const oldCoverUrl = employee.coverImageUrl;
    const imageUrl = await this.uploadsService.saveFile(file, 'avatars');
    const updated = await this.prisma.employee.update({
      where: { id },
      data: { coverImageUrl: imageUrl },
    });
    if (oldCoverUrl) {
      await this.uploadsService.deleteFile(oldCoverUrl);
    }
    return { data: updated };
  }

  // ── DELETE /api/employees/:id/cover ───────────────────────────────────────
  // Quita la foto de portada del empleado (borra el archivo y pone null en BD).
  @Delete(':id/cover')
  @RequirePermissions('employees.update')
  async deleteCover(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const employee = await this.employeesService.findOne(id, tenantId);
    // Si tenía portada, borramos el archivo físico antes de limpiar la BD.
    if (employee.coverImageUrl) {
      await this.uploadsService.deleteFile(employee.coverImageUrl);
    }
    const updated = await this.prisma.employee.update({
      where: { id },
      data: { coverImageUrl: null }, // null = "sin portada"
    });
    return { data: updated };
  }

  // ─── PORTFOLIO ─────────────────────────────────────

  // ── GET /api/employees/:id/portfolio ──────────────────────────────────────
  // Lista las imágenes del portafolio del empleado.
  @Get(':id/portfolio')
  @RequirePermissions('employees.read')
  async getPortfolio(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const images = await this.employeesService.getPortfolio(id, tenantId);
    return { data: images };
  }

  // ── POST /api/employees/:id/portfolio ─────────────────────────────────────
  // Sube una nueva imagen al portafolio (archivo + caption opcional).
  @Post(':id/portfolio')
  @RequirePermissions('employees.update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async addPortfolioImage(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: MulterFile,
    @Body() dto: CreatePortfolioImageDto,   // trae caption (opcional)
  ) {
    // Las imágenes de portafolio van a la carpeta 'portfolio'.
    const imageUrl = await this.uploadsService.saveFile(file, 'portfolio');
    const image = await this.employeesService.addPortfolioImage(
      id,
      tenantId,
      imageUrl,
      dto.caption,
    );
    return { data: image };
  }

  // ── DELETE /api/employees/:id/portfolio/:imageId ──────────────────────────
  // Borra una imagen del portafolio (de la BD y del disco).
  @Delete(':id/portfolio/:imageId')
  @RequirePermissions('employees.update')
  async removePortfolioImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,      // :imageId de la imagen a borrar
    @CurrentTenant() tenantId: string,
  ) {
    // El servicio borra la fila y nos devuelve la imagen (para conocer su URL).
    const image = await this.employeesService.removePortfolioImage(id, tenantId, imageId);
    // Luego borramos el archivo físico usando esa URL.
    await this.uploadsService.deleteFile(image.imageUrl);
    return { data: { message: 'Imagen eliminada' } };
  }

  // ── PATCH /api/employees/:id/portfolio/:imageId/visibility ────────────────
  // Muestra/oculta una imagen en el perfil público (PATCH = cambio parcial).
  @Patch(':id/portfolio/:imageId/visibility')
  @RequirePermissions('employees.update')
  async togglePortfolioVisibility(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentTenant() tenantId: string,
    @Body() body: { isHidden: boolean },
  ) {
    const image = await this.employeesService.togglePortfolioVisibility(
      // "!!body.isHidden" usa la doble negación para forzar el valor a un
      // booleano puro (true/false), por si llegara como string o undefined.
      id, tenantId, imageId, !!body.isHidden,
    );
    return { data: image };
  }

  // ── PATCH /api/employees/:id/portfolio/:imageId/featured ──────────────────
  // Marca/desmarca una imagen como destacada.
  @Patch(':id/portfolio/:imageId/featured')
  @RequirePermissions('employees.update')
  async togglePortfolioFeatured(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentTenant() tenantId: string,
    @Body() body: { isFeatured: boolean },
  ) {
    const image = await this.employeesService.togglePortfolioFeatured(
      // "!!body.isFeatured" → booleano puro (ver explicación de visibility).
      id, tenantId, imageId, !!body.isFeatured,
    );
    return { data: image };
  }

  // ─── REVIEWS ───────────────────────────────────────

  // ── GET /api/employees/:id/reviews ────────────────────────────────────────
  // Devuelve las reseñas del empleado y su promedio/total.
  @Get(':id/reviews')
  @RequirePermissions('employees.read')
  async getReviews(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.employeesService.getReviews(id, tenantId);
    return { data: result };
  }

  // ─── PERSONAL INFO ────────────────────────────────

  // ── PUT /api/employees/:id/personal-info ──────────────────────────────────
  // Un admin actualiza la info personal/médica de un empleado.
  @Put(':id/personal-info')
  @RequirePermissions('employees.update')
  async updatePersonalInfo(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdatePersonalInfoDto,
  ) {
    const employee = await this.employeesService.updatePersonalInfo(id, tenantId, dto);
    return { data: employee };
  }

  // ─── DOCUMENTS ────────────────────────────────────

  // ── GET /api/employees/:id/documents ──────────────────────────────────────
  // Lista los documentos del empleado (contratos, identificaciones, etc.).
  @Get(':id/documents')
  @RequirePermissions('employees.read')
  async getDocuments(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const documents = await this.employeesService.getDocuments(id, tenantId);
    return { data: documents };
  }

  // ── POST /api/employees/:id/documents ─────────────────────────────────────
  // Sube un documento (archivo). Si ya existía uno de ese tipo, lo reemplaza.
  @Post(':id/documents')
  @RequirePermissions('employees.update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async addDocument(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: MulterFile,
    @Body() dto: CreateDocumentDto,          // trae documentType
  ) {
    // Los documentos van a la carpeta 'documents'.
    const fileUrl = await this.uploadsService.saveFile(file, 'documents');
    const result = await this.employeesService.addDocument(id, tenantId, fileUrl, dto);
    // Si se reemplazó un documento previo, el servicio devuelve su URL vieja
    // (oldFileUrl) para que aquí borremos el archivo antiguo del disco.
    if (result.oldFileUrl) {
      await this.uploadsService.deleteFile(result.oldFileUrl);
    }
    return { data: result.document };
  }

  // ── DELETE /api/employees/:id/documents/:docId ────────────────────────────
  // Borra un documento (de la BD y del disco).
  @Delete(':id/documents/:docId')
  @RequirePermissions('employees.update')
  async removeDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,           // :docId del documento a borrar
    @CurrentTenant() tenantId: string,
  ) {
    const doc = await this.employeesService.removeDocument(id, tenantId, docId);
    await this.uploadsService.deleteFile(doc.fileUrl);
    return { data: { message: 'Documento eliminado' } };
  }

  // ─── TRAININGS ────────────────────────────────────

  // ── GET /api/employees/:id/trainings ──────────────────────────────────────
  // Lista las formaciones/capacitaciones del empleado.
  @Get(':id/trainings')
  @RequirePermissions('employees.read')
  async getTrainings(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const trainings = await this.employeesService.getTrainings(id, tenantId);
    return { data: trainings };
  }

  // ── POST /api/employees/:id/trainings ─────────────────────────────────────
  // Añade una formación. El archivo (certificado) es OPCIONAL.
  @Post(':id/trainings')
  @RequirePermissions('employees.update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async addTrainingWithFile(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: MulterFile,
    @Body() dto: CreateTrainingDto,
  ) {
    // Operador ternario: si vino un archivo lo guardamos y obtenemos su URL; si
    // no vino (file es undefined), fileUrl queda undefined (sin certificado).
    const fileUrl = file
      ? await this.uploadsService.saveFile(file, 'documents')
      : undefined;
    const training = await this.employeesService.addTraining(id, tenantId, dto, fileUrl);
    return { data: training };
  }

  // ── DELETE /api/employees/:id/trainings/:trainingId ───────────────────────
  // Borra una formación; si tenía certificado adjunto, también borra el archivo.
  @Delete(':id/trainings/:trainingId')
  @RequirePermissions('employees.update')
  async removeTraining(
    @Param('id') id: string,
    @Param('trainingId') trainingId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const training = await this.employeesService.removeTraining(id, tenantId, trainingId);
    // Solo borramos archivo si esta formación tenía uno asociado.
    if (training.fileUrl) {
      await this.uploadsService.deleteFile(training.fileUrl);
    }
    return { data: { message: 'Formación eliminada' } };
  }

  // ─── ROLES ────────────────────────────────────────

  // ── GET /api/employees/:id/roles ──────────────────────────────────────────
  // Devuelve los roles (y sus permisos) asignados al usuario del empleado.
  @Get(':id/roles')
  @RequirePermissions('employees.read')
  async getEmployeeRoles(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.employeesService.getEmployeeRoles(id, tenantId);
    return { data: result };
  }
}
