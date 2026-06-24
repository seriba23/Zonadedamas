// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos las "piezas" que el controlador necesita.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los decoradores que arman los endpoints HTTP:
import {
  // @Body(): lee el cuerpo (JSON) que el cliente envía en un POST/PUT.
  Body,
  // @Controller: marca la clase como controlador (un grupo de endpoints).
  Controller,
  // @Delete: marca un método como endpoint que responde a peticiones DELETE.
  Delete,
  // @Get: marca un método como endpoint que responde a peticiones GET.
  Get,
  // @Param: lee un trozo variable de la URL (ej. el :id de /resources/:id).
  Param,
  // @Post: marca un método como endpoint que responde a peticiones POST.
  Post,
  // @Put: marca un método como endpoint que responde a peticiones PUT.
  Put,
  // @Query: lee un parámetro de la query string (ej. ?assignedTo=...).
  Query,
  // @UploadedFile: extrae el archivo subido en una petición de tipo formulario.
  UploadedFile,
  // @UseGuards: aplica "guardias" (controles de acceso) a la clase/método.
  UseGuards,
  // @UseInterceptors: aplica "interceptores" (lógica que envuelve la petición),
  // aquí para procesar la subida de archivos.
  UseInterceptors,
} from '@nestjs/common';

// FileInterceptor: interceptor que recibe UN archivo de un formulario
// multipart/form-data. El texto 'file' (más abajo) es el nombre del campo.
import { FileInterceptor } from '@nestjs/platform-express';

// El servicio de recursos: la clase con la lógica real (BD, cálculos, etc.).
import { ResourcesService } from './resources.service';

// Los DTO (moldes con validación) para crear y actualizar recursos.
import { CreateResourceDto, UpdateResourceDto } from './dto/create-resource.dto';

// JwtAuthGuard: guardia que exige un token JWT válido (usuario autenticado).
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// PermissionGuard: guardia que comprueba que el usuario tenga los PERMISOS
// requeridos (los que se indican con @RequirePermissions).
import { PermissionGuard } from '../../common/guards/permission.guard';

// RequirePermissions: decorador para declarar QUÉ permiso hace falta en cada
// endpoint (formato "módulo.acción", ej. "resources.read").
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

// CurrentTenant: decorador que extrae el id del negocio (tenant) desde el token
// del usuario, para no tener que recibirlo manualmente en cada petición.
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

// PaginationDto: el molde con los parámetros de paginación (page, perPage).
import { PaginationDto } from '../../common/dto/pagination.dto';

// UploadsService: servicio que guarda y borra archivos en el servidor (para las
// imágenes de los recursos).
import { UploadsService } from '../uploads/uploads.service';

// @Controller('resources') => todas las rutas de esta clase empiezan con
// "/api/resources" (el prefijo "/api" se agrega globalmente en otra parte).
@Controller('resources')
// @UseGuards(...) aplicado a TODA la clase: cada endpoint exige primero un token
// válido (JwtAuthGuard) y luego los permisos correspondientes (PermissionGuard).
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ResourcesController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS: NestJS crea y nos pasa las dos
  // clases que necesitamos. "private readonly" las guarda como propiedades de
  // solo lectura (this.resourcesService, this.uploadsService).
  constructor(
    private readonly resourcesService: ResourcesService,
    private readonly uploadsService: UploadsService,
  ) {}

  // ── GET /api/resources ────────────────────────────────────────────────────
  // Lista los recursos del negocio (paginados, con filtro opcional por empleado).
  @Get()
  // Requiere el permiso de LECTURA de recursos.
  @RequirePermissions('resources.read')
  async findAll(
    // @CurrentTenant() => id del negocio sacado del token del usuario.
    @CurrentTenant() tenantId: string,
    // @Query() => recoge los parámetros de paginación (page, perPage) de la URL.
    @Query() pagination: PaginationDto,
    // @Query('assignedTo') => parámetro opcional para filtrar por empleado
    // asignado. El "?" indica que puede no venir.
    @Query('assignedTo') assignedTo?: string,
  ) {
    // Delegamos al servicio y devolvemos directamente su respuesta paginada.
    return this.resourcesService.findAll(tenantId, pagination, assignedTo);
  }

  // ── POST /api/resources ───────────────────────────────────────────────────
  // Crea un recurso nuevo.
  @Post()
  // Requiere el permiso de CREACIÓN de recursos.
  @RequirePermissions('resources.create')
  async create(
    @CurrentTenant() tenantId: string,
    // @Body() => los datos del recurso a crear, ya validados contra el DTO.
    @Body() dto: CreateResourceDto,
  ) {
    // El servicio crea el recurso; "await" espera a que termine (va a la BD).
    const resource = await this.resourcesService.create(tenantId, dto);
    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data: resource };
  }

  // ── GET /api/resources/:id ────────────────────────────────────────────────
  // Devuelve el detalle de UN recurso por su id.
  @Get(':id')
  @RequirePermissions('resources.read')
  async findOne(
    // @Param('id') => toma el valor que venga en la posición :id de la URL.
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const resource = await this.resourcesService.findOne(id, tenantId);
    return { data: resource };
  }

  // ── PUT /api/resources/:id ────────────────────────────────────────────────
  // Actualiza un recurso existente con los campos enviados.
  @Put(':id')
  @RequirePermissions('resources.update')
  async update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    // @Body() => los cambios a aplicar, validados contra el DTO de actualización.
    @Body() dto: UpdateResourceDto,
  ) {
    const resource = await this.resourcesService.update(id, tenantId, dto);
    return { data: resource };
  }

  // ── POST /api/resources/:id/image/:slot ───────────────────────────────────
  // Sube una imagen para un recurso. ":slot" indica EN CUÁL de las 3 ranuras de
  // imagen va (1, 2 o 3). Reemplaza la imagen previa de esa ranura si existía.
  @Post(':id/image/:slot')
  @RequirePermissions('resources.update')
  // @UseInterceptors(FileInterceptor('file')) => intercepta la subida y deja el
  // archivo disponible. 'file' es el nombre del campo del formulario.
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('id') id: string,        // id del recurso al que pertenece la imagen
    @Param('slot') slot: string,    // ranura de imagen: "1", "2" o "3"
    @CurrentTenant() tenantId: string,
    // @UploadedFile() => el archivo subido. ": any" porque su tipo es flexible.
    @UploadedFile() file: any,
  ) {
    // Buscamos el recurso (404 si no existe). "as any" para poder acceder a sus
    // campos de imagen por nombre dinámico más abajo sin que TypeScript proteste.
    const resource = await this.resourcesService.findOne(id, tenantId) as any;
    // fieldMap traduce el número de ranura ("1"/"2"/"3") al nombre real del
    // campo en la base de datos (imageUrl / imageUrl2 / imageUrl3).
    const fieldMap: Record<string, string> = { '1': 'imageUrl', '2': 'imageUrl2', '3': 'imageUrl3' };
    // field = el nombre de campo correspondiente a la ranura pedida.
    // "|| 'imageUrl'" => si la ranura no está en el mapa, usamos la principal.
    const field = fieldMap[slot] || 'imageUrl';

    // Si el recurso YA tenía una imagen en esa ranura, borramos el archivo viejo
    // del servidor antes de subir el nuevo (para no acumular basura).
    if (resource[field]) {
      await this.uploadsService.deleteFile(resource[field]);
    }
    // Guardamos el archivo nuevo en la carpeta 'resources' y obtenemos su URL.
    const url = await this.uploadsService.saveFile(file, 'resources');
    // Actualizamos el recurso poniendo esa URL en el campo correcto.
    // "{ [field]: url }" usa una CLAVE DINÁMICA: el nombre de la propiedad es el
    // valor de la variable "field" (imageUrl, imageUrl2 o imageUrl3).
    const updated = await this.resourcesService.update(id, tenantId, { [field]: url });
    return { data: updated };
  }

  // ── DELETE /api/resources/:id ─────────────────────────────────────────────
  // Desactiva (borrado lógico) un recurso.
  @Delete(':id')
  @RequirePermissions('resources.delete')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.resourcesService.remove(id, tenantId);
    return { data: result };
  }
}
