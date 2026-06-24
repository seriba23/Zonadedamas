// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos "piezas" de otras librerías/archivos para usarlas aquí.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los "decoradores" (etiquetas con "@") para declarar
// endpoints HTTP y leer partes de la petición:
//   - Controller: marca una clase como "controlador" (grupo de endpoints).
//   - Get / Post / Put / Delete: marcan un método como endpoint según el verbo
//     HTTP (leer / crear / actualizar / borrar).
//   - Body: lee el cuerpo (JSON) que envía el cliente en POST/PUT.
//   - Param: lee un trozo de la URL (ej. el :id de /suppliers/:id).
//   - Query: lee un parámetro de la query string (ej. ?page=2).
//   - UseGuards: aplica "guardias" (controles de seguridad) a la clase/método.
//   - Request: inyecta el objeto de la petición (req), del que sacamos el usuario.
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
// JwtAuthGuard: guardia que exige un token JWT válido (estar autenticado).
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// PermissionGuard: guardia que comprueba que el usuario tenga los permisos
// requeridos (los que se declaran con @RequirePermissions).
import { PermissionGuard } from '../../common/guards/permission.guard';
// RequirePermissions: decorador para indicar qué permiso(s) hace falta tener
// para entrar a cada endpoint (formato "modulo.accion").
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
// El servicio con la lógica real (consultar BD, crear, actualizar, etc.).
// El controlador solo recibe la petición HTTP y se la delega al servicio.
import { SuppliersService } from './suppliers.service';
// DTOs que definen y validan la forma de los datos que entran.
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

// @Controller('suppliers') => todas las rutas de esta clase empiezan con
// "/api/suppliers" (el prefijo "/api" se agrega globalmente en otra parte).
@Controller('suppliers')
// @UseGuards a nivel de clase => TODOS los endpoints de aquí exigen, en orden:
//   1) JwtAuthGuard: estar autenticado (token válido).
//   2) PermissionGuard: tener el permiso que pida cada método.
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SuppliersController {
  // INYECCIÓN DE DEPENDENCIAS: NestJS crea el servicio y lo pasa aquí.
  // "private readonly" lo guarda como propiedad (this.suppliersService) de solo
  // lectura (readonly = no se puede reasignar).
  constructor(private readonly suppliersService: SuppliersService) {}

  // ── GET /api/suppliers ────────────────────────────────────────────────────
  // Lista proveedores con paginación y filtro opcional por estado activo.
  @Get()
  @RequirePermissions('inventory.read') // requiere permiso de lectura de inventario
  findAll(
    // @Request() inyecta el objeto req; "req.user" lo rellenó JwtAuthGuard con
    // los datos del usuario autenticado (de ahí sacamos su tenantId).
    @Request() req: any,
    // @Query lee parámetros de la URL. Llegan SIEMPRE como texto (string) y son
    // opcionales (el "?" en el nombre del parámetro).
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.suppliersService.findAll(req.user.tenantId, {
      // Convertimos los textos a número con Number(), pero solo si vinieron:
      // "page ? Number(page) : undefined" => si page existe lo convierte; si no,
      // pasa undefined para que el servicio use su valor por defecto.
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      // isActive llega como texto. Si fue enviado (!== undefined), lo comparamos
      // con 'true': la expresión "isActive === 'true'" da un booleano real
      // (true solo si el texto era exactamente "true"). Si no se envió, undefined.
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  // ── GET /api/suppliers/:id ────────────────────────────────────────────────
  // Devuelve un proveedor concreto por su id.
  @Get(':id')
  @RequirePermissions('inventory.read')
  findOne(@Request() req: any, @Param('id') id: string) {
    // @Param('id') toma el valor que venga en la posición :id de la URL.
    return this.suppliersService.findOne(req.user.tenantId, id);
  }

  // ── POST /api/suppliers ───────────────────────────────────────────────────
  // Crea un nuevo proveedor.
  @Post()
  @RequirePermissions('inventory.create') // requiere permiso de creación
  create(@Request() req: any, @Body() dto: CreateSupplierDto) {
    // @Body() lee el JSON enviado y lo valida contra CreateSupplierDto.
    return this.suppliersService.create(
      req.user.tenantId, // negocio actual
      dto, // datos del proveedor
      req.user.userId, // quién lo crea (para la auditoría)
    );
  }

  // ── PUT /api/suppliers/:id ────────────────────────────────────────────────
  // Actualiza un proveedor existente.
  @Put(':id')
  @RequirePermissions('inventory.update') // requiere permiso de edición
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(
      req.user.tenantId,
      id,
      dto,
      req.user.userId,
    );
  }

  // ── DELETE /api/suppliers/:id ─────────────────────────────────────────────
  // Desactiva (borrado lógico) un proveedor.
  @Delete(':id')
  @RequirePermissions('inventory.delete') // requiere permiso de borrado
  remove(@Request() req: any, @Param('id') id: string) {
    return this.suppliersService.remove(
      req.user.tenantId,
      id,
      req.user.userId,
    );
  }
}
