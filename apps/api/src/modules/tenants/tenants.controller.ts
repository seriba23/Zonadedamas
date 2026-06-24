// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los "decoradores" (etiquetas "@") para declarar endpoints
// HTTP y leer partes de la petición:
//   - Body: lee el cuerpo (JSON) de la petición.
//   - Controller: marca la clase como un grupo de endpoints.
//   - Delete / Get / Post / Put: marcan un método como endpoint según el verbo
//     HTTP (borrar, leer, crear, actualizar).
//   - Param: lee un trozo variable de la URL (ej. el :id).
//   - Query: lee un parámetro de la query string (ej. ?q=...).
//   - UploadedFile: toma el archivo subido en una petición de tipo "multipart".
//   - UseGuards: aplica "guardias" (filtros de seguridad) antes del endpoint.
//   - UseInterceptors: aplica "interceptores" que envuelven la petición (aquí,
//     para procesar la subida de archivos).
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
// FileInterceptor: interceptor que captura UN archivo subido desde un formulario.
import { FileInterceptor } from '@nestjs/platform-express';
// El servicio con la lógica de negocio (consultas a la base de datos, etc.).
import { TenantsService } from './tenants.service';
// Los DTOs (formas válidas del JSON entrante) que ya documentamos en /dto.
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateLocationDto, UpdateLocationDto } from './dto/create-location.dto';
import { SetBusinessHoursDto } from './dto/business-hours.dto';
import { CreateBusinessClosureDto, ClosureQueryDto } from './dto/business-closure.dto';
import { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';
import { UpdateShopSettingsDto } from './dto/update-shop-settings.dto';
// @Public: marca un endpoint como público (sin necesidad de iniciar sesión).
import { Public } from '../../common/decorators/public.decorator';
// JwtAuthGuard: guardia que exige un token JWT válido (estar logueado).
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// PermissionGuard: guardia que exige tener cierto permiso (ej. "tenant.update").
import { PermissionGuard } from '../../common/guards/permission.guard';
// @RequirePermissions: declara qué permiso(s) hacen falta para un endpoint.
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
// @CurrentTenant: extrae el id del negocio (tenant) del token del usuario logueado.
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
// UploadsService: servicio que guarda/borra archivos físicos en el servidor.
import { UploadsService } from '../uploads/uploads.service';

// @Controller() sin texto => la clase NO añade prefijo propio; cada método
// define su ruta completa (ej. @Post('tenants') responde a /api/tenants).
@Controller()
export class TenantsController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS: NestJS crea e inyecta ambos
  // servicios automáticamente. "private readonly" los guarda como propiedades
  // de solo lectura (this.tenantsService y this.uploadsService).
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly uploadsService: UploadsService,
  ) {}

  // ── POST /api/tenants ─ Registro (onboarding) de un negocio nuevo. ─────────
  // @Public() => no requiere login (cualquiera puede registrar su negocio).
  @Public()
  @Post('tenants')
  async onboard(@Body() dto: CreateTenantDto) {
    // @Body() valida el JSON contra CreateTenantDto y lo entrega en "dto".
    // Le pedimos al servicio que cree el negocio + dueño + roles. "await"
    // espera a que termine (porque va a la base de datos).
    const result = await this.tenantsService.onboard(dto);
    // Respondemos en el formato estándar del proyecto: { data: ... }.
    return { data: result };
  }

  // ── GET /api/tenants/current ─ Datos del negocio del usuario logueado. ─────
  // Solo @UseGuards(JwtAuthGuard): basta con estar logueado (sin permiso extra).
  @UseGuards(JwtAuthGuard)
  @Get('tenants/current')
  async getCurrent(@CurrentTenant() tenantId: string) {
    // @CurrentTenant() saca el id del negocio del token del usuario.
    const tenant = await this.tenantsService.getCurrent(tenantId);
    return { data: tenant };
  }

  // ── PUT /api/tenants/profile ─ Actualizar el perfil del negocio. ───────────
  // @UseGuards(JwtAuthGuard, PermissionGuard): exige estar logueado Y...
  // @RequirePermissions('tenant.update'): ...tener el permiso "tenant.update".
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Put('tenants/profile')
  async updateProfile(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateTenantProfileDto,
  ) {
    // El servicio guarda los cambios y devuelve el negocio actualizado.
    const tenant = await this.tenantsService.updateProfile(tenantId, dto);
    return { data: tenant };
  }

  // ── POST /api/tenants/logo ─ Subir el logotipo del negocio. ────────────────
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Post('tenants/logo')
  // FileInterceptor('file', ...) captura el archivo que viene en el campo
  // "file" del formulario. "limits.fileSize: 5 * 1024 * 1024" lo limita a 5 MB
  // (5 megabytes = 5 × 1024 × 1024 bytes).
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadLogo(
    @CurrentTenant() tenantId: string,
    // @UploadedFile() entrega el archivo subido (tipo "any" = cualquier forma).
    @UploadedFile() file: any,
  ) {
    // 1) Guardamos el archivo físico en la carpeta "avatars" y obtenemos su URL.
    const imageUrl = await this.uploadsService.saveFile(file, 'avatars');
    // 2) Guardamos esa URL en el negocio; el servicio nos devuelve la URL del
    //    logo ANTERIOR (si había), para poder borrarlo después.
    const oldUrl = await this.tenantsService.updateLogo(tenantId, imageUrl);
    // 3) Si existía un logo previo, lo borramos del disco para no acumular basura.
    //    "if (oldUrl)" es verdadero solo si oldUrl NO es null/vacío.
    if (oldUrl) {
      await this.uploadsService.deleteFile(oldUrl);
    }
    // Devolvemos la nueva URL del logo.
    return { data: { logoUrl: imageUrl } };
  }

  // ── POST /api/tenants/cover ─ Subir la imagen de portada del negocio. ──────
  // (Mismo patrón exacto que uploadLogo, pero para la portada/cover.)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Post('tenants/cover')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadCover(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: any,
  ) {
    // Guardamos la imagen y obtenemos su URL.
    const imageUrl = await this.uploadsService.saveFile(file, 'avatars');
    // Actualizamos la portada y recuperamos la URL anterior (si la hubo).
    const oldUrl = await this.tenantsService.updateCover(tenantId, imageUrl);
    // Si había portada previa, la borramos del disco.
    if (oldUrl) {
      await this.uploadsService.deleteFile(oldUrl);
    }
    return { data: { coverImageUrl: imageUrl } };
  }

  // ── POST /api/locations ─ Crear una sucursal del negocio. ──────────────────
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('locations.create')
  @Post('locations')
  async createLocation(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateLocationDto,
  ) {
    // Creamos la sucursal asociada al negocio actual y la devolvemos.
    const location = await this.tenantsService.createLocation(tenantId, dto);
    return { data: location };
  }

  // ── GET /api/locations ─ Listar todas las sucursales del negocio. ──────────
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('locations.read')
  @Get('locations')
  async findAllLocations(@CurrentTenant() tenantId: string) {
    const locations = await this.tenantsService.findAllLocations(tenantId);
    return { data: locations };
  }

  // ── PUT /api/locations/:id ─ Editar una sucursal concreta. ─────────────────
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('locations.update')
  @Put('locations/:id')
  async updateLocation(
    // @Param('id') toma el id de la URL (/locations/<id>).
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    // Pasamos id + tenantId para que el servicio verifique que esa sucursal
    // pertenece al negocio antes de modificarla (seguridad multi-tenant).
    const location = await this.tenantsService.updateLocation(id, tenantId, dto);
    return { data: location };
  }

  // ── DELETE /api/locations/:id ─ Eliminar (soft delete) una sucursal. ───────
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('locations.delete')
  @Delete('locations/:id')
  async deleteLocation(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.tenantsService.deleteLocation(id, tenantId);
    return { data: result };
  }

  /**
   * Proxy a Nominatim para geocodificar una dirección. Va por backend porque:
   * 1) los browsers ignoran el header User-Agent y Nominatim aplica rate
   *    limit agresivo / bloquea User-Agents genericos de browser.
   * 2) podemos enviar un User-Agent identificable (Siliba/1.0 contact@siliba.com)
   *    como pide la politica de uso de Nominatim.
   * Se usa al editar/crear sucursales (boton "Buscar dirección en mapa").
   */
  /**
   * Proxy a Nominatim para geocodificar. Va por backend porque:
   * 1) browsers ignoran el header User-Agent y Nominatim aplica rate limit
   *    agresivo a User-Agents genericos de browser.
   * 2) podemos identificarnos correctamente segun politica de Nominatim.
   *
   * Acepta params estructurados (street, city, state, postalcode, country)
   * que Nominatim usa con mucha mayor precisión que un query libre. Si solo
   * viene `q=`, fallback al modo libre.
   *
   * Hace fallback progresivo desde la combinación mas precisa hasta solo
   * ciudad+pais, devolviendo `precision` para que el frontend avise al
   * usuario qué nivel se logró.
   */
  // ── GET /api/geocode ─ Convertir una dirección en coordenadas (lat/lng). ───
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('locations.update')
  @Get('geocode')
  async geocodeAddress(
    // "q" = consulta libre (toda la dirección en un solo texto).
    @Query('q') q: string,
    // El resto son partes estructuradas y opcionales de la dirección.
    @Query('street') street?: string,
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('postalcode') postalcode?: string,
    @Query('country') country?: string,
  ) {
    // MODO ESTRUCTURADO (preferido, más preciso). El "||" significa "O": si
    // vino al menos street, city o country, entramos aquí.
    if (street || city || country) {
      // "combos" será una lista de intentos, del más preciso al más general.
      // Cada intento lleva los "params" para Nominatim y un nivel de "precision".
      const combos: Array<{ params: Record<string, string>; precision: string }> = [];
      // 1. La combinación MÁS precisa: street + city + country, y si existen,
      //    también state y postalcode. El "&&" exige que las 3 estén presentes.
      if (street && city && country) {
        const full: Record<string, string> = { street, city, country };
        if (state) full.state = state;             // añade estado si vino
        if (postalcode) full.postalcode = postalcode; // añade CP si vino
        combos.push({ params: full, precision: 'address' });
      }
      // 2. Mismo trío pero SIN estado ni CP (por si lo anterior no acertó).
      if (street && city && country) {
        combos.push({ params: { street, city, country }, precision: 'address' });
      }
      // 3. city + country (+ state si vino): precisión a nivel de ciudad.
      if (city && country) {
        const c: Record<string, string> = { city, country };
        if (state) c.state = state;
        combos.push({ params: c, precision: 'city' });
      }
      // 4. Lo más general: solo city + country.
      if (city && country) {
        combos.push({ params: { city, country }, precision: 'city' });
      }
      // Probamos cada combinación EN ORDEN (de más precisa a menos). En cuanto
      // una devuelva resultado ("hit" verdadero), devolvemos ESE y paramos.
      // "...hit" copia las propiedades de hit (lat, lng, displayName) y le
      // añadimos el nivel de precisión logrado.
      for (const combo of combos) {
        const hit = await this.queryNominatim(combo.params);
        if (hit) return { data: { ...hit, precision: combo.precision } };
      }
      // Si ninguna combinación acertó, no hay coordenadas.
      return { data: null };
    }

    // MODO LEGACY (antiguo): solo viene "q" como texto libre.
    // "!q || !q.trim()": si q no existe, O si al quitarle espacios queda vacío,
    // devolvemos null (no hay nada que buscar). trim() = quita espacios sobrantes.
    if (!q || !q.trim()) return { data: null };
    const hit = await this.queryNominatim({ q });
    // Operador ternario: si hubo resultado, lo devolvemos con precision
    // "unknown" (desconocida); si no, devolvemos null.
    return { data: hit ? { ...hit, precision: 'unknown' } : null };
  }

  // Método PRIVADO de ayuda (private = solo se usa dentro de esta clase).
  // Recibe los parámetros de búsqueda y consulta el servicio externo Nominatim
  // (geocodificador de OpenStreetMap). Devuelve { lat, lng, displayName } si
  // encontró algo, o null si no.
  private async queryNominatim(
    params: Record<string, string>,
  ): Promise<{ lat: number; lng: number; displayName: string } | null> {
    // URLSearchParams arma la "query string" de la URL a partir de un objeto.
    // Fijamos opciones base y luego "...params" agrega las partes de la dirección.
    const search = new URLSearchParams({
      format: 'jsonv2',         // formato de respuesta que queremos (JSON v2)
      limit: '1',               // solo el mejor resultado
      'accept-language': 'es',  // respuestas en español
      addressdetails: '0',      // no necesitamos el desglose detallado
      ...params,
    });
    // Construimos la URL final concatenando la base con la query string.
    const url = `https://nominatim.openstreetmap.org/search?${search.toString()}`;
    // try/catch: si la llamada de red falla (sin internet, error, etc.),
    // saltamos al catch y devolvemos null en vez de romper la app.
    try {
      // fetch() hace la petición HTTP. Enviamos un User-Agent identificable,
      // como pide la política de uso de Nominatim.
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Siliba/1.0 (contact@siliba.com)',
          'Accept-Language': 'es',
        },
      });
      // res.ok es true si el servidor respondió con éxito (código 2xx).
      // Si NO fue ok, devolvemos null.
      if (!res.ok) return null;
      // Convertimos la respuesta a JSON.
      const json: any = await res.json();
      // Si la respuesta no es una lista, O está vacía (length === 0), no hubo
      // resultados -> null.
      if (!Array.isArray(json) || json.length === 0) return null;
      // Tomamos el primer (mejor) resultado.
      const top = json[0];
      // parseFloat convierte el texto del número a número real (decimal).
      // OJO: Nominatim devuelve "lon" (no "lng"); aquí lo renombramos a lng.
      return {
        lat: parseFloat(top.lat),
        lng: parseFloat(top.lon),
        displayName: top.display_name,
      };
    } catch {
      // Cualquier error de red/parseo => null (búsqueda fallida, sin romper).
      return null;
    }
  }

  // ─── Horarios del negocio (Business Hours) ───────────────────────────────
  // ── GET /api/tenant/business-hours ─ Leer los horarios de apertura. ────────
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.read')
  @Get('tenant/business-hours')
  async getBusinessHours(@CurrentTenant() tenantId: string) {
    const hours = await this.tenantsService.getBusinessHours(tenantId);
    return { data: hours };
  }

  // ── PUT /api/tenant/business-hours ─ Reemplazar los horarios de apertura. ──
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Put('tenant/business-hours')
  async setBusinessHours(
    @CurrentTenant() tenantId: string,
    @Body() dto: SetBusinessHoursDto,
  ) {
    const hours = await this.tenantsService.setBusinessHours(tenantId, dto);
    return { data: hours };
  }

  // ─── Cierres del negocio (Business Closures: vacaciones, feriados...) ─────
  // ── GET /api/tenant/closures ─ Listar cierres (opcionalmente por rango). ───
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.read')
  @Get('tenant/closures')
  async getClosures(
    @CurrentTenant() tenantId: string,
    // @Query() (sin nombre) toma TODA la query string y la valida como
    // ClosureQueryDto (con startDate y endDate opcionales).
    @Query() query: ClosureQueryDto,
  ) {
    // Pasamos las fechas del filtro (pueden ser undefined) al servicio.
    const closures = await this.tenantsService.getClosures(
      tenantId,
      query.startDate,
      query.endDate,
    );
    return { data: closures };
  }

  // ── POST /api/tenant/closures ─ Crear un cierre. ───────────────────────────
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Post('tenant/closures')
  async createClosure(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateBusinessClosureDto,
  ) {
    const closure = await this.tenantsService.createClosure(tenantId, dto);
    return { data: closure };
  }

  // ── DELETE /api/tenant/closures/:id ─ Borrar un cierre concreto. ───────────
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Delete('tenant/closures/:id')
  async deleteClosure(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.tenantsService.deleteClosure(id, tenantId);
    return { data: result };
  }

  // ─── Ajustes de la tienda (Shop Settings) ────────────────────────────────
  // ── GET /api/tenants/shop-settings ─ Leer la configuración de la tienda. ───
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Get('tenants/shop-settings')
  async getShopSettings(@CurrentTenant() tenantId: string) {
    const settings = await this.tenantsService.getShopSettings(tenantId);
    return { data: settings };
  }

  // ── PUT /api/tenants/shop-settings ─ Actualizar la configuración de tienda. ─
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Put('tenants/shop-settings')
  async updateShopSettings(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateShopSettingsDto,
  ) {
    const settings = await this.tenantsService.updateShopSettings(tenantId, dto);
    return { data: settings };
  }

  // ─── Reseñas (vista del owner sobre las reseñas que recibe su negocio) ────
  // ── GET /api/tenants/reviews ─ Resumen y listas de reseñas del negocio. ────
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.read')
  @Get('tenants/reviews')
  async getTenantReviewsForOwner(@CurrentTenant() tenantId: string) {
    const data = await this.tenantsService.getReviewsForOwner(tenantId);
    return { data };
  }

  // ─── Galería (Gallery: fotos del negocio para el marketplace) ────────────
  // ── GET /api/tenants/gallery ─ Listar las imágenes de la galería. ──────────
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.read')
  @Get('tenants/gallery')
  async getGallery(@CurrentTenant() tenantId: string) {
    const images = await this.tenantsService.getGallery(tenantId);
    return { data: images };
  }

  // ── POST /api/tenants/gallery ─ Subir una imagen a la galería. ─────────────
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Post('tenants/gallery')
  // Igual que el logo/portada: capturamos un archivo de máximo 5 MB.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async addGalleryImage(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: any,
  ) {
    // Guardamos el archivo físico en la carpeta "portfolio" y obtenemos su URL.
    const imageUrl = await this.uploadsService.saveFile(file, 'portfolio');
    // Registramos la imagen en la galería del negocio.
    const image = await this.tenantsService.addGalleryImage(tenantId, imageUrl);
    return { data: image };
  }

  // ── DELETE /api/tenants/gallery/:id ─ Quitar una imagen de la galería. ─────
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Delete('tenants/gallery/:id')
  async removeGalleryImage(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    // 1) Borramos el registro en la base de datos; el servicio nos devuelve la
    //    imagen borrada (para conocer su URL).
    const image = await this.tenantsService.removeGalleryImage(tenantId, id);
    // 2) Borramos también el archivo físico del disco usando esa URL.
    await this.uploadsService.deleteFile(image.imageUrl);
    return { data: { message: 'Imagen eliminada' } };
  }
}
