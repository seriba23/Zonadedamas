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
import { FileInterceptor } from '@nestjs/platform-express';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateLocationDto, UpdateLocationDto } from './dto/create-location.dto';
import { SetBusinessHoursDto } from './dto/business-hours.dto';
import { CreateBusinessClosureDto, ClosureQueryDto } from './dto/business-closure.dto';
import { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';
import { UpdateShopSettingsDto } from './dto/update-shop-settings.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { UploadsService } from '../uploads/uploads.service';

@Controller()
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly uploadsService: UploadsService,
  ) {}

  @Public()
  @Post('tenants')
  async onboard(@Body() dto: CreateTenantDto) {
    const result = await this.tenantsService.onboard(dto);
    return { data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Get('tenants/current')
  async getCurrent(@CurrentTenant() tenantId: string) {
    const tenant = await this.tenantsService.getCurrent(tenantId);
    return { data: tenant };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Put('tenants/profile')
  async updateProfile(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateTenantProfileDto,
  ) {
    const tenant = await this.tenantsService.updateProfile(tenantId, dto);
    return { data: tenant };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Post('tenants/logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadLogo(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: any,
  ) {
    const imageUrl = await this.uploadsService.saveFile(file, 'avatars');
    const oldUrl = await this.tenantsService.updateLogo(tenantId, imageUrl);
    if (oldUrl) {
      await this.uploadsService.deleteFile(oldUrl);
    }
    return { data: { logoUrl: imageUrl } };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Post('tenants/cover')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadCover(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: any,
  ) {
    const imageUrl = await this.uploadsService.saveFile(file, 'avatars');
    const oldUrl = await this.tenantsService.updateCover(tenantId, imageUrl);
    if (oldUrl) {
      await this.uploadsService.deleteFile(oldUrl);
    }
    return { data: { coverImageUrl: imageUrl } };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('locations.create')
  @Post('locations')
  async createLocation(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateLocationDto,
  ) {
    const location = await this.tenantsService.createLocation(tenantId, dto);
    return { data: location };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('locations.read')
  @Get('locations')
  async findAllLocations(@CurrentTenant() tenantId: string) {
    const locations = await this.tenantsService.findAllLocations(tenantId);
    return { data: locations };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('locations.update')
  @Put('locations/:id')
  async updateLocation(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    const location = await this.tenantsService.updateLocation(id, tenantId, dto);
    return { data: location };
  }

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
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('locations.update')
  @Get('geocode')
  async geocodeAddress(
    @Query('q') q: string,
    @Query('street') street?: string,
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('postalcode') postalcode?: string,
    @Query('country') country?: string,
  ) {
    // Modo estructurado (preferido): construimos combos progresivos.
    if (street || city || country) {
      const combos: Array<{ params: Record<string, string>; precision: string }> = [];
      // 1. street + city + state + postalcode + country (mas preciso)
      if (street && city && country) {
        const full: Record<string, string> = { street, city, country };
        if (state) full.state = state;
        if (postalcode) full.postalcode = postalcode;
        combos.push({ params: full, precision: 'address' });
      }
      // 2. street + city + country (sin estado ni CP)
      if (street && city && country) {
        combos.push({ params: { street, city, country }, precision: 'address' });
      }
      // 3. city + state + country
      if (city && country) {
        const c: Record<string, string> = { city, country };
        if (state) c.state = state;
        combos.push({ params: c, precision: 'city' });
      }
      // 4. solo city + country
      if (city && country) {
        combos.push({ params: { city, country }, precision: 'city' });
      }
      for (const combo of combos) {
        const hit = await this.queryNominatim(combo.params);
        if (hit) return { data: { ...hit, precision: combo.precision } };
      }
      return { data: null };
    }

    // Modo legacy: query libre tipo "Calle Num, Colonia, Ciudad, Region, CP, Pais".
    if (!q || !q.trim()) return { data: null };
    const hit = await this.queryNominatim({ q });
    return { data: hit ? { ...hit, precision: 'unknown' } : null };
  }

  private async queryNominatim(
    params: Record<string, string>,
  ): Promise<{ lat: number; lng: number; displayName: string } | null> {
    const search = new URLSearchParams({
      format: 'jsonv2',
      limit: '1',
      'accept-language': 'es',
      addressdetails: '0',
      ...params,
    });
    const url = `https://nominatim.openstreetmap.org/search?${search.toString()}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Siliba/1.0 (contact@siliba.com)',
          'Accept-Language': 'es',
        },
      });
      if (!res.ok) return null;
      const json: any = await res.json();
      if (!Array.isArray(json) || json.length === 0) return null;
      const top = json[0];
      return {
        lat: parseFloat(top.lat),
        lng: parseFloat(top.lon),
        displayName: top.display_name,
      };
    } catch {
      return null;
    }
  }

  // Business Hours
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.read')
  @Get('tenant/business-hours')
  async getBusinessHours(@CurrentTenant() tenantId: string) {
    const hours = await this.tenantsService.getBusinessHours(tenantId);
    return { data: hours };
  }

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

  // Business Closures
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.read')
  @Get('tenant/closures')
  async getClosures(
    @CurrentTenant() tenantId: string,
    @Query() query: ClosureQueryDto,
  ) {
    const closures = await this.tenantsService.getClosures(
      tenantId,
      query.startDate,
      query.endDate,
    );
    return { data: closures };
  }

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

  // Shop Settings
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Get('tenants/shop-settings')
  async getShopSettings(@CurrentTenant() tenantId: string) {
    const settings = await this.tenantsService.getShopSettings(tenantId);
    return { data: settings };
  }

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

  // Reviews (vista del owner sobre las reseñas que recibe su negocio)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.read')
  @Get('tenants/reviews')
  async getTenantReviewsForOwner(@CurrentTenant() tenantId: string) {
    const data = await this.tenantsService.getReviewsForOwner(tenantId);
    return { data };
  }

  // Gallery
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.read')
  @Get('tenants/gallery')
  async getGallery(@CurrentTenant() tenantId: string) {
    const images = await this.tenantsService.getGallery(tenantId);
    return { data: images };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Post('tenants/gallery')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async addGalleryImage(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: any,
  ) {
    const imageUrl = await this.uploadsService.saveFile(file, 'portfolio');
    const image = await this.tenantsService.addGalleryImage(tenantId, imageUrl);
    return { data: image };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('tenant.update')
  @Delete('tenants/gallery/:id')
  async removeGalleryImage(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const image = await this.tenantsService.removeGalleryImage(tenantId, id);
    await this.uploadsService.deleteFile(image.imageUrl);
    return { data: { message: 'Imagen eliminada' } };
  }
}
