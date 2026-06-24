// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los "decoradores" para declarar endpoints HTTP. Un
// decorador es una etiqueta "@" que se pone sobre una clase o método para darle
// un comportamiento extra.
//   - Body: lee el cuerpo (JSON) que envía el cliente en POST/PUT.
//   - Controller: marca la clase como controlador (un grupo de endpoints).
//   - Delete / Get / Post / Put: marcan un método como endpoint que responde al
//     verbo HTTP correspondiente (borrar, leer, crear, actualizar).
//   - Param: lee un trozo variable de la URL (ej. el :id de /roles/:id).
//   - UseGuards: aplica "guards" (porteros) que deciden si la petición puede
//     pasar o se rechaza ANTES de ejecutar el método.
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

// El servicio con la lógica real de RBAC. El controlador solo recibe la petición
// HTTP y delega el trabajo en este servicio.
import { RbacService } from './rbac.service';

// DTOs (clases que describen y validan la forma del JSON entrante):
//   - CreateRoleDto: para crear un rol.   - UpdateRoleDto: para actualizar un rol.
import { CreateRoleDto, UpdateRoleDto } from './dto/create-role.dto';
//   - AssignRoleDto: para asignar un rol a un usuario.
import { AssignRoleDto } from './dto/assign-role.dto';

// JwtAuthGuard = guard que verifica el token JWT (que el usuario haya iniciado
// sesión). Si el token falta o es inválido, rechaza con 401 (no autenticado).
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// PermissionGuard = guard que verifica los PERMISOS. Lee qué permisos exige el
// endpoint (vía @RequirePermissions) y los compara con los del usuario. Si le
// faltan, rechaza con 403 (prohibido). Es el corazón del control de acceso RBAC.
import { PermissionGuard } from '../../common/guards/permission.guard';

// RequirePermissions = decorador que ETIQUETA un endpoint con los permisos que
// requiere (ej. 'roles.read'). Esa etiqueta queda guardada como "metadata" y el
// PermissionGuard la lee después para decidir si deja pasar la petición.
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

// CurrentTenant = decorador propio que extrae el tenantId (el ID del negocio)
// desde el token del usuario y lo entrega como parámetro del método. Así cada
// consulta queda filtrada por su negocio (multi-tenant: cada negocio ve lo suyo).
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

// @Controller() sin texto => las rutas se definen completas en cada método
// (ej. @Get('roles') responde a GET /api/roles). El prefijo "/api" se agrega
// globalmente en otra parte de la app.
@Controller()
// @UseGuards(...) aplicado a TODA la clase => ambos guards se ejecutan, EN ORDEN,
// antes de CUALQUIER método de este controlador:
//   1) JwtAuthGuard: ¿el usuario está autenticado? (token válido)
//   2) PermissionGuard: ¿tiene los permisos que pide el método?
// Solo si los dos dicen "sí", se ejecuta el método del endpoint.
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RbacController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS: NestJS crea el RbacService y nos lo
  // "inyecta" aquí automáticamente. "private readonly" lo guarda como propiedad
  // de solo lectura (this.rbacService) para usarlo en los métodos de abajo.
  constructor(private readonly rbacService: RbacService) {}

  // ── GET /api/roles ─────────────────────────────────────────────────────────
  // Lista todos los roles del negocio actual.
  @Get('roles')
  // @RequirePermissions('roles.read') => para entrar aquí, el usuario debe tener
  // el permiso 'roles.read'. El PermissionGuard comprueba esto antes de ejecutar.
  @RequirePermissions('roles.read')
  async findAllRoles(@CurrentTenant() tenantId: string) {
    // @CurrentTenant() => inyecta el tenantId del usuario logueado en "tenantId".
    // Le pedimos al servicio los roles de ESE negocio. "await" espera a que la
    // consulta a la base de datos termine antes de continuar.
    const roles = await this.rbacService.findAllRoles(tenantId);
    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data: roles };
  }

  // ── POST /api/roles ────────────────────────────────────────────────────────
  // Crea un rol nuevo en el negocio actual.
  @Post('roles')
  // Requiere el permiso 'roles.create'.
  @RequirePermissions('roles.create')
  async createRole(
    @CurrentTenant() tenantId: string, // negocio donde se crea el rol
    @Body() dto: CreateRoleDto,        // datos del rol (nombre, descripción, permisos)
  ) {
    // Delegamos la creación al servicio, pasándole el negocio y los datos.
    const role = await this.rbacService.createRole(tenantId, dto);
    return { data: role };
  }

  // ── PUT /api/roles/:id ─────────────────────────────────────────────────────
  // Actualiza un rol existente (su nombre, descripción y/o permisos).
  @Put('roles/:id')
  // Requiere el permiso 'roles.update'.
  @RequirePermissions('roles.update')
  async updateRole(
    @Param('id') id: string,           // :id de la URL = qué rol actualizar
    @CurrentTenant() tenantId: string, // negocio (para asegurar que el rol es suyo)
    @Body() dto: UpdateRoleDto,        // campos a cambiar
  ) {
    const role = await this.rbacService.updateRole(id, tenantId, dto);
    return { data: role };
  }

  // ── DELETE /api/roles/:id ──────────────────────────────────────────────────
  // Elimina un rol del negocio actual.
  @Delete('roles/:id')
  // Requiere el permiso 'roles.delete'.
  @RequirePermissions('roles.delete')
  async deleteRole(
    @Param('id') id: string,           // qué rol borrar
    @CurrentTenant() tenantId: string, // negocio dueño del rol
  ) {
    const result = await this.rbacService.deleteRole(id, tenantId);
    return { data: result };
  }

  // ── GET /api/permissions ───────────────────────────────────────────────────
  // Lista TODOS los permisos disponibles del sistema (agrupados por módulo).
  // Sirve, por ejemplo, para pintar la pantalla donde se eligen permisos de un rol.
  @Get('permissions')
  // Requiere 'roles.read' (quien gestiona roles necesita ver los permisos).
  @RequirePermissions('roles.read')
  async findAllPermissions() {
    // No recibe tenantId: los permisos son globales del sistema, iguales para
    // todos los negocios.
    const permissions = await this.rbacService.findAllPermissions();
    return { data: permissions };
  }

  // ── POST /api/user-roles ───────────────────────────────────────────────────
  // Asigna un rol a un usuario (le da el conjunto de permisos de ese rol).
  @Post('user-roles')
  // Requiere 'users.manage' (gestionar usuarios), no 'roles.*': aquí no editamos
  // el rol, sino a quién se le otorga.
  @RequirePermissions('users.manage')
  async assignRole(
    @CurrentTenant() tenantId: string, // negocio
    @Body() dto: AssignRoleDto,        // { userId, roleId }
  ) {
    const result = await this.rbacService.assignRole(tenantId, dto);
    return { data: result };
  }

  // ── DELETE /api/user-roles/:id ─────────────────────────────────────────────
  // Quita una asignación de rol a un usuario (le retira esos permisos).
  @Delete('user-roles/:id')
  // También requiere 'users.manage'.
  @RequirePermissions('users.manage')
  async removeRole(
    @Param('id') id: string,           // :id = el ID de la ASIGNACIÓN (userRole), no del rol ni del usuario
    @CurrentTenant() tenantId: string, // negocio (para verificar pertenencia)
  ) {
    const result = await this.rbacService.removeRole(id, tenantId);
    return { data: result };
  }
}
