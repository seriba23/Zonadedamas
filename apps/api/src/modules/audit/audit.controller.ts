// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos "piezas" de otras librerías y archivos para usarlas aquí.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos decoradores y utilidades para declarar el endpoint:
//   - Controller: marca una clase como "controlador" (un grupo de endpoints).
//   - Get: marca un método como endpoint que responde a peticiones GET.
//   - Query: lee parámetros de la query string (ej. ?page=2&action=CREATE).
//   - UseGuards: aplica "guardias" (controles de seguridad) que deben pasar
//     antes de ejecutar el endpoint.
import { Controller, Get, Query, UseGuards } from '@nestjs/common';

// Importamos el servicio (la lógica de verdad) y el tipo AuditFilters (el molde
// de los filtros) desde el archivo del servicio de auditoría.
import { AuditService, AuditFilters } from './audit.service';

// JwtAuthGuard: guardia que exige un token JWT válido. Si el usuario no está
// autenticado (no inició sesión), rechaza la petición con error 401.
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// PermissionGuard: guardia que comprueba que el usuario tenga el PERMISO concreto
// requerido por el endpoint. Si no lo tiene, rechaza con error 403.
import { PermissionGuard } from '../../common/guards/permission.guard';

// RequirePermissions: decorador para DECLARAR qué permiso exige un endpoint.
// Trabaja en equipo con PermissionGuard (uno declara, el otro verifica).
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

// CurrentTenant: decorador que extrae el tenantId (negocio) del usuario logueado
// a partir de su token, y lo inyecta como argumento del método. Así no hay que
// leerlo a mano de la petición.
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

// De class-validator importamos decoradores de validación que se ponen sobre las
// propiedades de un DTO para comprobar automáticamente lo que llega del cliente:
//   - IsOptional: el campo puede faltar (no es obligatorio).
//   - IsString: si el campo viene, debe ser texto (string).
import { IsOptional, IsString } from 'class-validator';

// PaginationDto: clase base con los campos de paginación (page, perPage) ya
// validados. Nuestro DTO de abajo la EXTIENDE para heredarlos.
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * AuditQueryDto = el "molde" de los parámetros que acepta el endpoint de
 * auditoría (lo que llega en la query string). "extends PaginationDto" hace que
 * además de los filtros de aquí, herede page y perPage de la paginación.
 * Los decoradores @IsOptional + @IsString validan cada campo automáticamente.
 */
class AuditQueryDto extends PaginationDto {
  // entityType: filtrar por tipo de entidad. Opcional y, si viene, debe ser texto.
  @IsOptional()
  @IsString()
  entityType?: string;

  // entityId: filtrar por id concreto de entidad. Opcional, texto si viene.
  @IsOptional()
  @IsString()
  entityId?: string;

  // userId: filtrar por el usuario que hizo la acción. Opcional, texto si viene.
  @IsOptional()
  @IsString()
  userId?: string;

  // action: filtrar por tipo de acción (CREATE/UPDATE/...). Opcional, texto.
  @IsOptional()
  @IsString()
  action?: string;

  // startDate: fecha de inicio del rango. Opcional, texto si viene.
  @IsOptional()
  @IsString()
  startDate?: string;

  // endDate: fecha de fin del rango. Opcional, texto si viene.
  @IsOptional()
  @IsString()
  endDate?: string;
}

// @Controller('audit') => todas las rutas de esta clase empiezan con "/api/audit"
// (el prefijo "/api" se agrega globalmente en otra parte de la app).
@Controller('audit')
// @UseGuards(...) aplica DOS guardias a TODOS los endpoints de esta clase, en
// orden: primero JwtAuthGuard (¿está logueado?) y luego PermissionGuard
// (¿tiene el permiso requerido?). Si cualquiera falla, la petición se rechaza.
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS: NestJS crea el AuditService y nos lo
  // inyecta aquí. "private readonly" lo guarda como propiedad (this.auditService)
  // de solo lectura, para usarlo en los métodos de abajo.
  constructor(private readonly auditService: AuditService) {}

  // ── GET /api/audit ──────────────────────────────────────────────────────────
  // Devuelve la bitácora de auditoría del negocio, filtrada y paginada.
  @Get()
  // @RequirePermissions('audit.read') => este endpoint EXIGE el permiso
  // "audit.read". El PermissionGuard (declarado arriba) leerá esta etiqueta y
  // comprobará que el usuario realmente lo tenga; si no, responde 403.
  @RequirePermissions('audit.read')
  async findAll(
    // @CurrentTenant() => inyecta automáticamente el tenantId del usuario logueado.
    @CurrentTenant() tenantId: string,
    // @Query() => toma TODA la query string y la convierte/valida en un
    // AuditQueryDto (con sus filtros y paginación).
    @Query() query: AuditQueryDto,
  ) {
    // Delegamos el trabajo al servicio. "query as AuditFilters" es un "cast":
    // le decimos a TypeScript que trate el query como del tipo AuditFilters
    // (son compatibles en campos), para que coincida con lo que findAll espera.
    return this.auditService.findAll(tenantId, query as AuditFilters);
  }
}
