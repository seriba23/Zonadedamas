// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los "decoradores" (etiquetas "@") para declarar endpoints:
//   - Controller: marca la clase como un grupo de endpoints HTTP.
//   - Get / Post / Put / Delete: marcan un método como endpoint del verbo HTTP
//     correspondiente (leer / crear / reemplazar / borrar).
//   - Body: lee el cuerpo (JSON) que el cliente envía en la petición.
//   - Param: lee un trozo variable de la URL (ej. el :id de /service-bundles/:id).
//   - Query: lee un parámetro de la query string (ej. ?page=2).
//   - UseGuards: aplica "guardias" (filtros de seguridad) a la clase o método.
//   - Request: nos da acceso al objeto de la petición (donde está el usuario).
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';

// JwtAuthGuard = guardia que exige un token JWT válido. Si el usuario no ha
// iniciado sesión (o el token es inválido), bloquea la petición con error 401.
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// PermissionGuard = guardia que comprueba que el usuario tenga el PERMISO
// requerido para el endpoint. Si no lo tiene, bloquea con error 403.
import { PermissionGuard } from '../../common/guards/permission.guard';

// RequirePermissions = decorador para indicar QUÉ permiso exige cada endpoint
// (ej. 'services.read'). El PermissionGuard de arriba lee esta indicación.
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

// El servicio con la lógica real (consultar BD, calcular, validar). El
// controlador solo recibe la petición y delega el trabajo en este servicio.
import { ServiceBundlesService } from './service-bundles.service';

// Los DTOs que describen la forma del JSON de entrada al crear/actualizar.
import { CreateServiceBundleDto } from './dto/create-service-bundle.dto';
import { UpdateServiceBundleDto } from './dto/update-service-bundle.dto';

// @Controller('service-bundles') => todas las rutas de esta clase empiezan con
// "/api/service-bundles". (El prefijo "/api" se agrega globalmente en otra parte.)
@Controller('service-bundles')
// @UseGuards(...) aplica los DOS guardias a TODOS los endpoints de esta clase:
// primero exige sesión válida (JwtAuthGuard) y luego el permiso (PermissionGuard).
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ServiceBundlesController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS:
  // NestJS crea una instancia del servicio y nos la "inyecta" aquí.
  // "private readonly" la guarda como propiedad (this.serviceBundlesService) de
  // solo lectura, para usarla en los métodos de abajo.
  constructor(private readonly serviceBundlesService: ServiceBundlesService) {}

  // ── GET /api/service-bundles ──────────────────────────────────────────────
  // Lista (paginada) los paquetes del negocio. Requiere el permiso services.read.
  @Get()
  @RequirePermissions('services.read')
  findAll(
    // @Request() nos da el objeto de la petición. req.user lo rellena el
    // JwtAuthGuard con los datos del usuario logueado (tenantId, userId, etc.).
    @Request() req: any,
    // @Query('page') lee ?page=... de la URL. Llega como texto (string) y es
    // opcional (el "?"). Lo mismo para perPage e isActive.
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('isActive') isActive?: string,
  ) {
    // Llamamos al servicio pasándole el tenantId (para filtrar por negocio) y un
    // objeto con los filtros ya convertidos al tipo correcto:
    return this.serviceBundlesService.findAll(req.user.tenantId, {
      // "page ? Number(page) : undefined": ternario. Si "page" vino (no vacío),
      // lo convertimos de texto a número con Number(); si no vino, undefined
      // (para que el servicio use su valor por defecto). Igual con perPage.
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      // isActive llega como texto "true"/"false". Aquí:
      //   - Si NO vino (isActive === undefined), pasamos undefined (sin filtro).
      //   - Si vino, "isActive === 'true'" devuelve true cuando el texto es
      //     exactamente "true", y false en cualquier otro caso. Así lo
      //     convertimos de texto a booleano de verdad.
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  // ── GET /api/service-bundles/:id ──────────────────────────────────────────
  // Devuelve UN paquete concreto por su id. Requiere services.read.
  @Get(':id')
  @RequirePermissions('services.read')
  // @Param('id') toma el valor que venga en la posición :id de la URL.
  findOne(@Request() req: any, @Param('id') id: string) {
    // Pasamos el tenantId (para que solo busque dentro de SU negocio) y el id.
    return this.serviceBundlesService.findOne(req.user.tenantId, id);
  }

  // ── POST /api/service-bundles ─────────────────────────────────────────────
  // Crea un nuevo paquete. Requiere services.create.
  @Post()
  @RequirePermissions('services.create')
  // @Body() dto = el JSON enviado, ya validado contra CreateServiceBundleDto.
  create(@Request() req: any, @Body() dto: CreateServiceBundleDto) {
    return this.serviceBundlesService.create(
      req.user.tenantId, // negocio dueño del paquete
      dto,               // datos del nuevo paquete
      req.user.userId,   // quién lo crea (para la auditoría)
    );
  }

  // ── PUT /api/service-bundles/:id ──────────────────────────────────────────
  // Actualiza un paquete existente. Requiere services.update.
  @Put(':id')
  @RequirePermissions('services.update')
  update(
    @Request() req: any,
    @Param('id') id: string,                 // id del paquete a actualizar
    @Body() dto: UpdateServiceBundleDto,     // campos a cambiar (todos opcionales)
  ) {
    return this.serviceBundlesService.update(
      req.user.tenantId,
      id,
      dto,
      req.user.userId,
    );
  }

  // ── DELETE /api/service-bundles/:id ───────────────────────────────────────
  // "Elimina" un paquete (en realidad lo desactiva, ver el servicio).
  // Requiere services.delete.
  @Delete(':id')
  @RequirePermissions('services.delete')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.serviceBundlesService.remove(
      req.user.tenantId,
      id,
      req.user.userId,
    );
  }
}
