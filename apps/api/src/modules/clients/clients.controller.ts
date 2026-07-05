// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos "piezas" de otras librerías para poder usarlas aquí.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los "decoradores" para declarar endpoints HTTP. Un
// decorador es una etiqueta que empieza con "@" y se pone arriba de una clase o
// método para darle un comportamiento extra.
//   - Body: lee el cuerpo (JSON) que el cliente envía en POST/PUT.
//   - Controller: marca una clase como "controlador" (un grupo de endpoints).
//   - Delete / Get / Post / Put: marcan un método como endpoint que responde a
//     ese verbo HTTP (DELETE para borrar, GET para leer, POST para crear, PUT
//     para actualizar).
//   - Param: lee un trozo de la URL (ej. el :id de /clients/:id).
//   - Query: lee parámetros de la query string (ej. ?search=ana&page=2).
//   - UseGuards: aplica "guardias" (clases que vigilan el acceso) al
//     controlador o método antes de ejecutar la lógica.
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

// El servicio con la lógica real (consultar BD, crear, editar, borrar, etc.).
import { ClientsService } from './clients.service';

// DTOs para crear/actualizar un cliente (definen la forma del cuerpo JSON y sus
// validaciones).
import { CreateClientDto, UpdateClientDto } from './dto/create-client.dto';

// DTOs para buscar clientes (filtros + paginación) y para crear etiquetas.
import { SearchClientsDto, CreateClientTagDto } from './dto/search-clients.dto';

// JwtAuthGuard: guardia que exige un token JWT válido (usuario autenticado).
// Si no hay token o es inválido, responde 401 (no autorizado).
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// PermissionGuard: guardia que comprueba que el usuario tenga los permisos
// requeridos (declarados con @RequirePermissions). Si no, responde 403.
import { PermissionGuard } from '../../common/guards/permission.guard';

// RequirePermissions: decorador para declarar QUÉ permiso necesita un endpoint
// (ej. "clients.read"). El PermissionGuard lo lee para decidir el acceso.
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

// CurrentTenant: decorador propio que extrae el tenantId (id del negocio) del
// token JWT del usuario y lo inyecta como argumento del método. Así cada
// consulta queda filtrada por el negocio correcto (multi-tenant).
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

// IsString: decorador de validación (de class-validator) usado en el pequeño
// DTO local de abajo.
import { IsString } from 'class-validator';

// DTO local mínimo para el cuerpo de "añadir etiqueta a un cliente": solo
// necesita el id de la etiqueta (tagId), que debe ser texto.
class AddTagDto {
  @IsString()
  tagId: string;
}

// @Controller('clients') => todas las rutas de esta clase empiezan con
// "/api/clients" (el prefijo "/api" se agrega globalmente en otra parte).
// @UseGuards(JwtAuthGuard, PermissionGuard) => TODOS los endpoints de esta clase
// exigen, primero, estar autenticado (JWT) y, segundo, tener el permiso que
// cada método declare con @RequirePermissions.
@Controller('clients')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ClientsController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS:
  // NestJS crea una instancia del servicio y la "inyecta" aquí. "private
  // readonly" la guarda como propiedad de solo lectura (this.clientsService).
  constructor(private readonly clientsService: ClientsService) {}

  // ── GET /api/clients ──────────────────────────────────────────────────────
  // Lista clientes con filtros y paginación. Requiere permiso "clients.read".
  @Get()
  @RequirePermissions('clients.read')
  async findAll(
    // @CurrentTenant() inyecta el id del negocio del usuario logueado.
    @CurrentTenant() tenantId: string,
    // @Query() recoge TODOS los parámetros de la query string y los mete en un
    // objeto validado con la forma de SearchClientsDto.
    @Query() query: SearchClientsDto,
  ) {
    // Delegamos la búsqueda al servicio y devolvemos lo que él retorne
    // (ya viene paginado con su propia estructura { data, meta }).
    return this.clientsService.findAll(tenantId, query);
  }

  // ── POST /api/clients ─────────────────────────────────────────────────────
  // Crea un nuevo cliente. Requiere permiso "clients.create".
  @Post()
  @RequirePermissions('clients.create')
  async create(
    @CurrentTenant() tenantId: string,
    // @Body() lee el JSON del cuerpo y lo valida con CreateClientDto.
    @Body() dto: CreateClientDto,
  ) {
    // "await" espera a que el servicio termine de crear el cliente en la BD.
    const client = await this.clientsService.create(tenantId, dto);
    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data: client };
  }

  // ── POST /api/clients/:id/claim-token ─────────────────────────────────────
  // Genera (o reutiliza) el token de "reclamo" para invitar por WhatsApp al
  // cliente walk-in a crear/vincular su cuenta real. Devuelve { token }.
  @Post(':id/claim-token')
  @RequirePermissions('clients.update')
  async claimToken(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const data = await this.clientsService.generateClaimToken(id, tenantId);
    return { data };
  }

  // ── GET /api/clients/tags ─────────────────────────────────────────────────
  // Lista todas las etiquetas del negocio. Requiere "clients.read".
  // OJO: se declara ANTES de @Get(':id') a propósito. Si estuviera después,
  // "tags" podría interpretarse como un :id. El orden importa en el ruteo.
  @Get('tags')
  @RequirePermissions('clients.read')
  async findAllTags(@CurrentTenant() tenantId: string) {
    const tags = await this.clientsService.findAllTags(tenantId);
    return { data: tags };
  }

  // ── POST /api/clients/tags ────────────────────────────────────────────────
  // Crea una etiqueta nueva. Requiere "clients.update" (modificar catálogo de
  // etiquetas se considera una actualización del negocio).
  @Post('tags')
  @RequirePermissions('clients.update')
  async createTag(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateClientTagDto,
  ) {
    const tag = await this.clientsService.createTag(tenantId, dto);
    return { data: tag };
  }

  // ── GET /api/clients/:id ──────────────────────────────────────────────────
  // Devuelve un cliente concreto por su id. Requiere "clients.read".
  @Get(':id')
  @RequirePermissions('clients.read')
  async findOne(
    // @Param('id') toma el valor de la posición :id de la URL.
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const client = await this.clientsService.findOne(id, tenantId);
    return { data: client };
  }

  /**
   * Resumen completo del cliente para la vista de detalle: info basica,
   * proximas citas, trabajos realizados, pagos, cupones activos, puntos.
   */
  // ── GET /api/clients/:id/summary ──────────────────────────────────────────
  @Get(':id/summary')
  @RequirePermissions('clients.read')
  async getSummary(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    // El servicio ya devuelve el objeto envuelto en { data: ... }, por eso aquí
    // retornamos directamente su resultado sin volver a envolverlo.
    return this.clientsService.getSummary(id, tenantId);
  }

  // ── PUT /api/clients/:id ──────────────────────────────────────────────────
  // Actualiza un cliente. Requiere "clients.update".
  @Put(':id')
  @RequirePermissions('clients.update')
  async update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateClientDto,
  ) {
    const client = await this.clientsService.update(id, tenantId, dto);
    return { data: client };
  }

  // ── DELETE /api/clients/:id ───────────────────────────────────────────────
  // "Elimina" un cliente (borrado lógico: lo marca inactivo). Requiere
  // "clients.delete".
  @Delete(':id')
  @RequirePermissions('clients.delete')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.clientsService.remove(id, tenantId);
    return { data: result };
  }

  // ── POST /api/clients/:id/tags ────────────────────────────────────────────
  // Asocia una etiqueta existente a un cliente. Requiere "clients.update".
  @Post(':id/tags')
  @RequirePermissions('clients.update')
  async addTag(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    // El cuerpo trae el id de la etiqueta a asociar (validado con AddTagDto).
    @Body() dto: AddTagDto,
  ) {
    // Pasamos el id de cliente, el tenant y el tagId que viene en el cuerpo.
    const result = await this.clientsService.addTag(id, tenantId, dto.tagId);
    return { data: result };
  }

  // ── DELETE /api/clients/:id/tags/:tagId ───────────────────────────────────
  // Quita una etiqueta de un cliente. Requiere "clients.update".
  @Delete(':id/tags/:tagId')
  @RequirePermissions('clients.update')
  async removeTag(
    // Aquí leemos DOS parámetros de la URL: el id del cliente y el de la etiqueta.
    @Param('id') id: string,
    @Param('tagId') tagId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.clientsService.removeTag(id, tenantId, tagId);
    return { data: result };
  }
}
