// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos "piezas" de otras librerías para definir los endpoints HTTP
// de la tienda (shop). Un endpoint es una URL a la que el navegador puede llamar.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los "decoradores" (etiquetas "@") para declarar endpoints:
import {
  Controller,        // marca la clase como "controlador" (un grupo de endpoints).
  Get,               // marca un método como endpoint que responde a peticiones GET.
  Post,              // marca un método como endpoint que responde a peticiones POST.
  Body,              // lee el cuerpo (JSON) que el cliente envía en un POST.
  Param,             // lee un trozo de la URL (ej. el :tenantSlug o :id de la ruta).
  Query,             // lee un parámetro de la query string (ej. ?page=2&category=x).
  UseGuards,         // aplica "guards" (vigilantes) que dejan pasar o no la petición.
  UseInterceptors,   // aplica "interceptores" que procesan la petición (aquí, archivos).
  UploadedFile,      // extrae el archivo subido (ej. una imagen) del formulario.
  Req,               // da acceso al objeto "request" crudo (para leer req.user, etc.).
} from '@nestjs/common';
// FileInterceptor procesa la subida de UN archivo en un formulario multipart
// (cuando el cliente sube una imagen). Lo configuramos con un límite de tamaño.
import { FileInterceptor } from '@nestjs/platform-express';
// Throttle = "limitador de peticiones": impide llamar a un endpoint demasiadas
// veces seguidas (protección anti-abuso/spam).
import { Throttle } from '@nestjs/throttler';
// El servicio de la tienda: tiene la lógica real. El controlador solo recibe la
// petición y se la pasa al servicio.
import { ShopService } from './shop.service';
// Los DTOs: describen y validan la forma del JSON que envía el cliente al apartar
// uno o varios productos.
import { CreateReservationDto, CreateBatchReservationDto } from './dto/create-reservation.dto';
// Guard "opcional": si el cliente viene con sesión iniciada (token JWT), lo
// identifica y rellena req.user; si NO viene, igual deja pasar (req.user vacío).
// Sirve para endpoints que funcionan tanto para invitados como para usuarios.
import { MarketplaceJwtOptionalGuard } from '../marketplace/guards/marketplace-jwt-optional.guard';
// Guard "obligatorio": exige que el cliente esté autenticado. Si no trae token
// válido, rechaza la petición (error 401). Se usa donde hace falta saber quién es.
import { MarketplaceJwtGuard } from '../marketplace/guards/marketplace-jwt.guard';
// Servicio para guardar/borrar archivos en disco (las capturas de comprobantes).
import { UploadsService } from '../uploads/uploads.service';

// @Controller('public/:tenantSlug/shop') => todas las rutas de esta clase
// empiezan con "/api/public/:tenantSlug/shop". El ":tenantSlug" es una parte
// VARIABLE de la URL: identifica de qué negocio es la tienda (ej. .../mi-salon/shop).
// El prefijo "/api" se agrega globalmente en otra parte del proyecto.
@Controller('public/:tenantSlug/shop')
export class ShopController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS:
  // NestJS crea automáticamente las instancias de estos servicios y nos las
  // "inyecta" aquí. "private readonly" las guarda como propiedades de la clase
  // (this.shopService, this.uploadsService) de solo lectura (no reasignables).
  constructor(
    private readonly shopService: ShopService,
    private readonly uploadsService: UploadsService,
  ) {}

  // ── GET /api/public/:tenantSlug/shop/settings ─────────────────────────────
  // Devuelve la configuración de la tienda del negocio: métodos de pago
  // aceptados, opciones de entrega y datos SPEI. Es lo primero que carga la web.
  @Get('settings')
  getSettings(@Param('tenantSlug') tenantSlug: string) {
    // @Param('tenantSlug') => toma el slug del negocio que viene en la URL.
    // Delegamos al servicio y devolvemos lo que él devuelva.
    return this.shopService.getShopSettings(tenantSlug);
  }

  // ── GET /api/public/:tenantSlug/shop/products ─────────────────────────────
  // Devuelve la lista (paginada) de productos a la venta del negocio.
  @Get('products')
  getProducts(
    @Param('tenantSlug') tenantSlug: string,
    // Los 3 parámetros llevan "?" => son OPCIONALES en la query string.
    // Llegan como texto (string), aunque page/perPage representen números.
    @Query('page') page?: string,       // ?page=2 => número de página.
    @Query('perPage') perPage?: string, // ?perPage=20 => cuántos por página.
    @Query('category') category?: string, // ?category=Cuidado => filtro por categoría.
  ) {
    return this.shopService.getProducts(tenantSlug, {
      // OPERADOR TERNARIO: "condición ? valorSiVerdad : valorSiFalso".
      // "page ? Number(page) : undefined" => si vino "page" (texto), lo
      // convertimos a número con Number(); si no vino, mandamos undefined para
      // que el servicio use su valor por defecto.
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      // "category" se pasa tal cual (ya es texto o undefined).
      category,
    });
  }

  // ── GET /api/public/:tenantSlug/shop/products/:id ─────────────────────────
  // Devuelve el detalle de UN producto concreto (por su id).
  @Get('products/:id')
  getProductDetail(
    @Param('tenantSlug') tenantSlug: string, // de qué negocio.
    @Param('id') id: string,                 // qué producto (su id en la URL).
  ) {
    return this.shopService.getProductDetail(tenantSlug, id);
  }

  // ── POST /api/public/:tenantSlug/shop/reserve ─────────────────────────────
  // Aparta UN producto (crea una reserva). Modifica datos (baja stock), por eso
  // es POST.
  @Post('reserve')
  // Guard opcional: identifica al usuario SI trae sesión, pero también permite
  // apartar como invitado (sin cuenta).
  @UseGuards(MarketplaceJwtOptionalGuard)
  // Límite: máximo 20 llamadas por minuto (ttl = 60000 ms = 60 s) por IP.
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  createReservation(
    @Param('tenantSlug') tenantSlug: string, // negocio dueño de la tienda.
    @Body() dto: CreateReservationDto,       // datos validados de la reserva.
    @Req() req: any,                         // request crudo, para leer el usuario.
  ) {
    // "req.user?.marketplaceUserId": el "?." (optional chaining) evita un error
    // si "req.user" no existe (cliente invitado): en ese caso devuelve undefined
    // en lugar de romper. Así el servicio sabe si la reserva tiene dueño o no.
    return this.shopService.createReservation(tenantSlug, dto, req.user?.marketplaceUserId);
  }

  // ── POST /api/public/:tenantSlug/shop/reserve-batch ───────────────────────
  // Aparta VARIOS productos a la vez (un carrito completo) en una sola llamada.
  @Post('reserve-batch')
  @UseGuards(MarketplaceJwtOptionalGuard)
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  createBatchReservation(
    @Param('tenantSlug') tenantSlug: string,
    @Body() dto: CreateBatchReservationDto, // lleva un arreglo de items.
    @Req() req: any,
  ) {
    return this.shopService.createBatchReservation(tenantSlug, dto, req.user?.marketplaceUserId);
  }

  // Cliente sube captura de pantalla del comprobante de transferencia.
  // Devuelve la URL para que el cliente la incluya en el body del reserve.
  // ── POST /api/public/:tenantSlug/shop/upload-payment-proof ────────────────
  @Post('upload-payment-proof')
  // Límite más bajo (10/min) porque subir archivos consume más recursos.
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  // Interceptor que procesa el archivo del campo de formulario llamado 'file'.
  // limits.fileSize = tamaño máximo permitido: 5 * 1024 * 1024 = 5 MB (en bytes).
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadPaymentProof(@UploadedFile() file: any) {
    // @UploadedFile() => extrae el archivo subido. "await" espera a que el
    // servicio termine de guardarlo en disco (en la carpeta 'payments') y nos
    // devuelva la URL pública resultante.
    const imageUrl = await this.uploadsService.saveFile(file, 'payments');
    // Respondemos en el formato estándar del proyecto: { data: ... } con la URL.
    return { data: { paymentProofUrl: imageUrl } };
  }

  // Adjuntar/reemplazar la captura del comprobante en una reserva ya
  // creada. Util cuando el cliente eligio SPEI pero todavia no habia
  // hecho la transferencia al momento de apartar.
  // ── POST /api/public/:tenantSlug/shop/reservations/:id/payment-proof ──────
  // Guard OBLIGATORIO: aquí sí necesitamos saber quién es (solo el dueño de la
  // reserva puede adjuntar su comprobante), así que exigimos sesión iniciada.
  @UseGuards(MarketplaceJwtGuard)
  @Post('reservations/:id/payment-proof')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async attachPaymentProof(
    @Param('tenantSlug') tenantSlug: string,    // negocio.
    @Param('id') reservationId: string,         // qué reserva (su id en la URL).
    @UploadedFile() file: any,                  // la nueva captura subida.
    @Req() req: any,                            // request, para leer el usuario.
  ) {
    return this.shopService.attachPaymentProof(
      tenantSlug,
      reservationId,
      file,
      // Aquí NO usamos "?." porque el guard obligatorio garantiza que req.user
      // existe; si no existiera, la petición ya habría sido rechazada antes.
      req.user.marketplaceUserId,
    );
  }
}
