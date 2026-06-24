// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos "piezas" de otras librerías para poder usarlas aquí.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los "decoradores" (etiquetas "@") y utilidades para definir
// endpoints HTTP. Recordatorio: un decorador se pone arriba de una clase, método o
// parámetro para darle un comportamiento extra.
//   - Controller: marca una clase como "controlador" (grupo de endpoints).
//   - Get/Post/Put/Delete: marcan un método como endpoint del verbo HTTP correspondiente.
//   - Body: lee el cuerpo (JSON) que el cliente envía en la petición.
//   - Param: lee un trozo de la URL (ej. el :id de /products/:id).
//   - Query: lee un parámetro de la query string (ej. ?page=2).
//   - UseGuards: aplica "guardias" (validaciones de seguridad) antes de entrar al método.
//   - UseInterceptors: aplica "interceptores" que procesan la petición/respuesta
//     (aquí, para recibir archivos subidos).
//   - UploadedFile: extrae el archivo subido del formulario multipart.
//   - Request: da acceso al objeto crudo de la petición (req), de donde leemos el
//     usuario autenticado (req.user) que el guard JWT dejó allí.
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
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';

// FileInterceptor: interceptor de NestJS/Express que captura UN archivo subido bajo
// un nombre de campo concreto (aquí 'file') y lo deja disponible en @UploadedFile().
import { FileInterceptor } from '@nestjs/platform-express';

// JwtAuthGuard: guardia que exige un token JWT válido. Sin él, la petición se
// rechaza con 401 (no autenticado). Además rellena req.user con los datos del token.
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// PermissionGuard: guardia que comprueba que el usuario tenga el permiso requerido
// (lo declaramos con @RequirePermissions). Si no lo tiene, responde 403 (prohibido).
import { PermissionGuard } from '../../common/guards/permission.guard';

// RequirePermissions: decorador que indica QUÉ permiso(s) necesita un endpoint
// (formato "modulo.accion", p. ej. "inventory.read"). Lo lee PermissionGuard.
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

// El servicio con la lógica real (consultas a BD, cálculos, etc.).
import { ProductsService } from './products.service';

// DTOs ("Data Transfer Objects"): clases que describen y validan la forma de los
// datos que llegan en el body al crear/actualizar un producto.
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// @Controller('products') => todas las rutas de esta clase empiezan con
// "/api/products". (El prefijo "/api" se agrega globalmente en otra parte.)
@Controller('products')
// @UseGuards(JwtAuthGuard, PermissionGuard) aplicado a NIVEL DE CLASE => TODOS los
// endpoints de abajo exigen primero un JWT válido y luego el permiso requerido.
// Se ejecutan en orden: primero autentica (JWT), después autoriza (permisos).
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProductsController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS:
  // NestJS crea una instancia de ProductsService y nos la "inyecta" aquí.
  // "private readonly" la guarda como propiedad (this.productsService) de solo
  // lectura, para usarla en todos los métodos.
  constructor(private readonly productsService: ProductsService) {}

  // ── GET /api/products/low-stock ───────────────────────────────────────────
  // Lista los productos con stock bajo (paginados). Importante: este endpoint
  // se declara ANTES que @Get(':id') porque NestJS evalúa las rutas en orden;
  // si estuviera después, "low-stock" se confundiría con un :id.
  @Get('low-stock')
  // Requiere el permiso "inventory.read" (poder leer inventario).
  @RequirePermissions('inventory.read')
  findLowStock(
    // @Request() da acceso al objeto petición; de req.user.tenantId sacamos el
    // negocio del usuario (multi-tenant: cada negocio ve solo sus datos).
    @Request() req: any,
    // @Query('page') lee ?page=... de la URL. El "?" indica que es opcional.
    @Query('page') page?: string,
    // @Query('perPage') lee ?perPage=... (cuántos por página). Opcional.
    @Query('perPage') perPage?: string,
  ) {
    // Delegamos en el servicio pasándole el tenantId y la paginación. Como los
    // query params llegan SIEMPRE como texto, los convertimos a número:
    //   - "page ? Number(page) : undefined": si vino un valor (truthy), lo
    //     convertimos a número con Number(); si no vino, pasamos undefined para
    //     que el servicio use su valor por defecto.
    return this.productsService.findLowStock(req.user.tenantId, {
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
    });
  }

  // ── GET /api/products/reservations ────────────────────────────────────────
  // Lista los "apartados" (reservas de productos) del negocio, paginados y con
  // filtro opcional por estado (PENDING, CONFIRMED, etc.).
  @Get('reservations')
  @RequirePermissions('inventory.read')
  findAllReservations(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    // @Query('status') lee ?status=... para filtrar por estado del apartado. Opcional.
    @Query('status') status?: string,
  ) {
    return this.productsService.findAllReservations(req.user.tenantId, {
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      // "status" no se convierte a número: es un texto (el nombre del estado).
      status,
    });
  }

  // ── GET /api/products/sales-stats?startDate=...&endDate=... ────────────────
  // Devuelve estadísticas de ventas de productos en un rango de fechas.
  // Es "async" porque dentro espera (await) consultas a la base de datos.
  @Get('sales-stats')
  @RequirePermissions('inventory.read')
  async salesStats(
    @Request() req: any,
    // Fechas de inicio/fin del rango (texto "YYYY-MM-DD"). Ambas opcionales: si
    // no llegan, el servicio calcula el total histórico.
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Pasamos el rango como un objeto { startDate, endDate } al servicio.
    return this.productsService.getSalesStats(req.user.tenantId, { startDate, endDate });
  }

  /**
   * Apartados cobrables desde el POS: status no terminal + (sin cita o
   * cita CANCELLED). Los apartados de citas activas se cobran al cobrar
   * la cita, asi que no se listan aqui para evitar doble cobro.
   */
  // ── GET /api/products/reservations/payable ────────────────────────────────
  // Lista los apartados que SÍ se pueden cobrar desde el POS (ver el JSDoc de
  // arriba). Nota: aquí el permiso es "payments.create" (poder cobrar), no
  // "inventory.read", porque esto alimenta el flujo de cobro.
  @Get('reservations/payable')
  @RequirePermissions('payments.create')
  findPayableReservations(@Request() req: any) {
    return this.productsService.findPayableReservations(req.user.tenantId);
  }

  // ── PUT /api/products/reservations/:id/status ─────────────────────────────
  // Cambia el estado de un apartado (p. ej. PENDING -> CONFIRMED). Requiere
  // permiso para modificar inventario.
  @Put('reservations/:id/status')
  @RequirePermissions('inventory.update')
  updateReservationStatus(
    @Request() req: any,
    // @Param('id') toma el valor de la posición :id de la URL (el id del apartado).
    @Param('id') id: string,
    // @Body('status') lee SOLO el campo "status" del JSON enviado (el nuevo estado).
    @Body('status') status: string,
  ) {
    // Pasamos también req.user.userId (quién hace el cambio) para la auditoría.
    return this.productsService.updateReservationStatus(
      req.user.tenantId,
      id,
      status,
      req.user.userId,
    );
  }

  // ── GET /api/products ─────────────────────────────────────────────────────
  // Lista TODOS los productos del negocio, paginados y con varios filtros
  // opcionales (categoría, proveedor, activo/inactivo, stock bajo).
  // @Get() sin argumento => responde a la ruta base "/api/products".
  @Get()
  @RequirePermissions('inventory.read')
  findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    // Filtro por categoría (texto). Opcional.
    @Query('category') category?: string,
    // Filtro por proveedor (id del proveedor). Opcional.
    @Query('supplierId') supplierId?: string,
    // Filtro por activo/inactivo. Llega como texto "true"/"false". Opcional.
    @Query('isActive') isActive?: string,
    // Filtro de stock bajo. Llega como texto "true"/"false". Opcional.
    @Query('lowStock') lowStock?: string,
  ) {
    return this.productsService.findAll(req.user.tenantId, {
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      category,
      supplierId,
      // Los flags llegan como texto; aquí los pasamos a booleano de verdad:
      //   - "isActive !== undefined": ¿llegó el parámetro? (!== es "distinto de").
      //   - Si llegó, "isActive === 'true'" da true SOLO si el texto es exactamente
      //     "true"; cualquier otra cosa ("false", etc.) da false.
      //   - Si NO llegó, pasamos undefined (sin filtro).
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      lowStock: lowStock !== undefined ? lowStock === 'true' : undefined,
    });
  }

  // ── GET /api/products/:id/sales ───────────────────────────────────────────
  // Devuelve el historial de ventas de UN producto concreto (POS + apartados),
  // incluyendo comprador, vendedor y comisión generada.
  @Get(':id/sales')
  @RequirePermissions('inventory.read')
  getSales(@Request() req: any, @Param('id') id: string) {
    return this.productsService.getSales(req.user.tenantId, id);
  }

  // ── GET /api/products/:id ─────────────────────────────────────────────────
  // Devuelve UN producto por su id. Va DESPUÉS de las rutas más específicas
  // (low-stock, reservations, :id/sales) para no "tragárselas" como si fueran ids.
  @Get(':id')
  @RequirePermissions('inventory.read')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.productsService.findOne(req.user.tenantId, id);
  }

  // ── POST /api/products ────────────────────────────────────────────────────
  // Crea un producto nuevo. Requiere permiso "inventory.create".
  @Post()
  @RequirePermissions('inventory.create')
  // @Body() dto: lee TODO el JSON enviado y lo valida contra CreateProductDto.
  create(@Request() req: any, @Body() dto: CreateProductDto) {
    // Pasamos tenantId (de quién es el producto) y userId (quién lo crea, para auditoría).
    return this.productsService.create(
      req.user.tenantId,
      dto,
      req.user.userId,
    );
  }

  // ── PUT /api/products/:id ─────────────────────────────────────────────────
  // Actualiza un producto existente con los campos que vengan en el body.
  @Put(':id')
  @RequirePermissions('inventory.update')
  update(
    @Request() req: any,
    @Param('id') id: string,
    // El body se valida contra UpdateProductDto (todos sus campos son opcionales).
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(
      req.user.tenantId,
      id,
      dto,
      req.user.userId,
    );
  }

  // ── DELETE /api/products/:id ──────────────────────────────────────────────
  // Elimina un producto. Requiere el permiso "inventory.delete".
  @Delete(':id')
  @RequirePermissions('inventory.delete')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.productsService.remove(
      req.user.tenantId,
      id,
      req.user.userId,
    );
  }

  // ─── Image Management ────────────────────────────
  // Endpoints para gestionar las imágenes de un producto: imagen principal y
  // galería (hasta 5 fotos extra).

  // ── POST /api/products/:id/image ──────────────────────────────────────────
  // Sube/reemplaza la imagen PRINCIPAL del producto.
  @Post(':id/image')
  @RequirePermissions('inventory.update')
  // @UseInterceptors(FileInterceptor('file')) => intercepta el archivo subido en
  // el campo de formulario llamado 'file' y lo deja disponible en @UploadedFile().
  @UseInterceptors(FileInterceptor('file'))
  uploadMainImage(
    @Request() req: any,
    @Param('id') id: string,
    // @UploadedFile() recibe el archivo capturado por el interceptor.
    @UploadedFile() file: any,
  ) {
    return this.productsService.uploadMainImage(
      req.user.tenantId,
      id,
      file,
      req.user.userId,
    );
  }

  // ── POST /api/products/:id/gallery ────────────────────────────────────────
  // Agrega UNA imagen más a la galería del producto (máximo 5).
  @Post(':id/gallery')
  @RequirePermissions('inventory.update')
  @UseInterceptors(FileInterceptor('file'))
  addGalleryImage(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    return this.productsService.addGalleryImage(
      req.user.tenantId,
      id,
      file,
      req.user.userId,
    );
  }

  // ── DELETE /api/products/:id/gallery/:imageId ─────────────────────────────
  // Elimina UNA imagen concreta de la galería del producto.
  @Delete(':id/gallery/:imageId')
  @RequirePermissions('inventory.update')
  removeGalleryImage(
    @Request() req: any,
    // :id => id del producto.
    @Param('id') id: string,
    // :imageId => id de la imagen dentro de la galería de ese producto.
    @Param('imageId') imageId: string,
  ) {
    return this.productsService.removeGalleryImage(
      req.user.tenantId,
      id,
      imageId,
    );
  }
}
