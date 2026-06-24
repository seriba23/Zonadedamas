// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos "piezas" de otras librerías y archivos para usarlas aquí.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS (el framework del backend) importamos los "decoradores" que sirven
// para declarar endpoints HTTP. Un decorador es una etiqueta que empieza con "@"
// y se pone arriba de una clase, método o parámetro para darle comportamiento.
//   - Body: lee el cuerpo (JSON) que el cliente envía en un POST/PUT.
//   - Controller: marca una clase como "controlador" (un grupo de endpoints).
//   - Delete / Get / Post / Put: marcan un método como endpoint que responde a
//     ese verbo HTTP (borrar, leer, crear, actualizar respectivamente).
//   - Param: lee un trozo de la URL (ej. el :id de /services/:id).
//   - Query: lee parámetros de la query string (ej. ?page=2&perPage=20).
//   - UseGuards: aplica "guardias" (filtros de seguridad) antes de ejecutar.
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

// ServicesService: la clase con la lógica de verdad (consultar/escribir la base
// de datos). El controlador solo recibe la petición y se la pasa al servicio.
import { ServicesService } from './services.service';

// DTOs (Data Transfer Objects): clases que describen y validan la "forma" de los
// datos que llegan en el cuerpo de la petición.
//   - CreateServiceDto: campos para crear un servicio.
//   - UpdateServiceDto: campos para actualizar un servicio (todos opcionales).
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto';

// JwtAuthGuard: guardia que exige un token JWT válido (que el usuario esté
// logueado). Si no hay token o es inválido, responde 401 (no autorizado).
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// PermissionGuard: guardia que comprueba que el usuario tenga el permiso
// requerido (ver @RequirePermissions abajo). Si no lo tiene, responde 403.
import { PermissionGuard } from '../../common/guards/permission.guard';

// RequirePermissions: decorador propio que marca QUÉ permiso necesita un método
// (ej. 'services.read'). El PermissionGuard lee esta marca para decidir.
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

// CurrentTenant: decorador propio que extrae el tenantId (el negocio actual)
// desde el token JWT y lo inyecta como parámetro. Así cada consulta se filtra
// por su negocio (multi-tenant: cada negocio solo ve lo suyo).
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

// PaginationDto: clase que valida los parámetros de paginación de la query
// (page, perPage) y les pone valores por defecto y límites.
import { PaginationDto } from '../../common/dto/pagination.dto';

// @Controller('services') => todas las rutas de esta clase empiezan con
// "/api/services" (el prefijo "/api" se agrega globalmente en otra parte).
@Controller('services')
// @UseGuards(...) a nivel de clase => TODOS los endpoints de abajo pasan primero
// por estas dos guardias, en orden:
//   1) JwtAuthGuard: exige estar logueado.
//   2) PermissionGuard: exige tener el permiso que cada método declare.
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ServicesController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS:
  // NestJS crea automáticamente una instancia de ServicesService y nos la
  // "inyecta" aquí. "private readonly" la guarda como propiedad de la clase
  // (this.servicesService) y la hace de solo lectura (no se puede reasignar).
  constructor(private readonly servicesService: ServicesService) {}

  // ── GET /api/services?page=&perPage= ───────────────────────────────────────
  // Lista (paginada) los servicios activos del negocio.
  @Get()
  // Para entrar aquí, el usuario necesita el permiso 'services.read' (leer).
  @RequirePermissions('services.read')
  async findAll(
    // @CurrentTenant() => inyecta el id del negocio actual (sacado del JWT).
    @CurrentTenant() tenantId: string,
    // @Query() => toma TODOS los parámetros de la query y los mete en un
    // PaginationDto ya validado (page, perPage).
    @Query() pagination: PaginationDto,
  ) {
    // Delegamos en el servicio y devolvemos directamente su respuesta (que ya
    // viene en formato paginado { data, meta }).
    return this.servicesService.findAll(tenantId, pagination);
  }

  // ── POST /api/services/auto-populate ───────────────────────────────────────
  // Crea automáticamente servicios "de catálogo" según el tipo de negocio
  // (ej. una barbería arranca con cortes, etc.). Útil al dar de alta el negocio.
  @Post('auto-populate')
  // Crear servicios requiere el permiso 'services.create'.
  @RequirePermissions('services.create')
  async autoPopulate(@CurrentTenant() tenantId: string) {
    // "await" espera a que el servicio termine (va a la base de datos). El
    // resultado dice cuántos servicios se crearon.
    const result = await this.servicesService.autoPopulateFromCatalog(tenantId);
    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data: result };
  }

  // ── POST /api/services ─────────────────────────────────────────────────────
  // Crea un servicio nuevo con los datos enviados en el cuerpo.
  @Post()
  @RequirePermissions('services.create')
  async create(
    @CurrentTenant() tenantId: string,
    // @Body() => lee el JSON enviado y lo valida contra CreateServiceDto.
    @Body() dto: CreateServiceDto,
  ) {
    const service = await this.servicesService.create(tenantId, dto);
    return { data: service };
  }

  // ── GET /api/services/:id ──────────────────────────────────────────────────
  // Devuelve UN servicio concreto por su id (con sus addons, recursos y
  // empleados asignados).
  @Get(':id')
  @RequirePermissions('services.read')
  async findOne(
    // @Param('id') => toma el valor que venga en la posición :id de la URL.
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const service = await this.servicesService.findOne(id, tenantId);
    return { data: service };
  }

  // ── PUT /api/services/:id ──────────────────────────────────────────────────
  // Actualiza un servicio existente con los campos enviados (todos opcionales).
  @Put(':id')
  @RequirePermissions('services.update')
  async update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    // El cuerpo se valida contra UpdateServiceDto (campos opcionales).
    @Body() dto: UpdateServiceDto,
  ) {
    const service = await this.servicesService.update(id, tenantId, dto);
    return { data: service };
  }

  // ── DELETE /api/services/:id ───────────────────────────────────────────────
  // "Borra" un servicio. (En realidad es un borrado lógico: lo desactiva,
  // como veremos en el servicio).
  @Delete(':id')
  @RequirePermissions('services.delete')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.servicesService.remove(id, tenantId);
    return { data: result };
  }

  // ── PUT /api/services/:id/employees ────────────────────────────────────────
  // Define QUÉ empleados pueden realizar este servicio (y su comisión). Reemplaza
  // la lista completa: los que no vengan en el cuerpo quedan desasignados.
  @Put(':id/employees')
  // Modificar asignaciones cuenta como actualizar el servicio.
  @RequirePermissions('services.update')
  async setEmployees(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    // El cuerpo trae un objeto con un array "employees". Cada elemento del array:
    //   - employeeId: id del empleado a asignar (obligatorio).
    //   - commission?: monto/porcentaje de comisión, opcional ("?"). Puede ser
    //     null para "sin comisión".
    //   - commissionType?: 'AMOUNT' (cantidad fija) o 'PERCENT' (porcentaje).
    @Body() body: {
      employees: {
        employeeId: string;
        commission?: number | null;
        commissionType?: 'AMOUNT' | 'PERCENT';
      }[];
    },
  ) {
    // "body?.employees ?? []":
    //   - "body?." (optional chaining): si "body" llegara undefined, no rompe;
    //     devuelve undefined en vez de lanzar error.
    //   - "?? []" (nullish coalescing): si lo de la izquierda es null/undefined,
    //     usa un array vacío. Así el servicio siempre recibe un array válido.
    const result = await this.servicesService.setEmployees(
      id,
      tenantId,
      body?.employees ?? [],
    );
    return { data: result };
  }
}
