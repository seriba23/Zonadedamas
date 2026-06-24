// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: "piezas" de NestJS para declarar endpoints HTTP (las URLs de la API).
// Un decorador es una etiqueta que empieza con "@" y se pone arriba de una clase
// o método para darle un comportamiento extra.
// ─────────────────────────────────────────────────────────────────────────────
import {
  Controller, // marca la clase como un "controlador" (un grupo de endpoints).
  Get,        // marca un método como endpoint que responde a peticiones GET (leer).
  Post,       // endpoint que responde a POST (crear).
  Put,        // endpoint que responde a PUT (actualizar/reemplazar).
  Delete,     // endpoint que responde a DELETE (borrar).
  Body,       // lee el cuerpo (JSON) que el cliente envía en la petición.
  Param,      // lee un trozo variable de la URL (ej. el :id de /rewards/:id).
  Query,      // lee un parámetro de la query string (ej. ?page=2).
  UseGuards,  // aplica "guardias" (controles de acceso) a la clase o método.
  Request,    // permite acceder al objeto de la petición (req), donde está el usuario.
} from '@nestjs/common';

// Decoradores de validación para el pequeño DTO que se define justo abajo.
import { IsString, IsUUID } from 'class-validator';

// DTO local para "regalar una recompensa". Describe y valida el body del POST
// /rewards/gift. Ambos campos deben ser UUID válidos (identificadores únicos).
class GiftRewardDto {
  @IsUUID() // rewardId: qué recompensa se regala (debe ser un UUID).
  rewardId: string;

  @IsUUID() // clientId: a qué cliente se le regala (debe ser un UUID).
  clientId: string;
}

// JwtAuthGuard: guardia que exige un token JWT válido (usuario autenticado).
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// PermissionGuard: guardia que verifica que el usuario tenga el permiso exigido.
import { PermissionGuard } from '../../common/guards/permission.guard';
// RequirePermissions: decorador que declara qué permiso necesita cada endpoint.
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
// El servicio con toda la lógica de recompensas (consultas a la base de datos).
import { RewardsService } from './rewards.service';
// DTOs que validan el body al crear y actualizar recompensas.
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';

// @Controller('rewards') => todas las rutas de esta clase empiezan con
// "/api/rewards" (el prefijo "/api" se agrega globalmente en otra parte).
@Controller('rewards')
// @UseGuards aplica DOS guardias a TODOS los endpoints de esta clase, en orden:
//   1) JwtAuthGuard: debes estar autenticado (token válido).
//   2) PermissionGuard: además debes tener el permiso que pida cada método.
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RewardsController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS: NestJS crea automáticamente una
  // instancia del servicio y la "inyecta" aquí. "private readonly" la guarda
  // como propiedad de solo lectura (this.rewardsService) para usarla abajo.
  constructor(private readonly rewardsService: RewardsService) {}

  // ── GET /api/rewards ──────────────────────────────────────────────────────
  // Lista (paginada) las recompensas del negocio. Exige el permiso rewards.read.
  @Get()
  @RequirePermissions('rewards.read')
  findAll(
    // @Request() inyecta el objeto de la petición; req.user lo rellena el
    // JwtAuthGuard con los datos del usuario autenticado (entre ellos tenantId).
    @Request() req: any,
    // @Query lee parámetros de la URL. Todos llegan como TEXTO y son opcionales.
    @Query('page') page?: string,        // número de página (?page=2).
    @Query('perPage') perPage?: string,  // cuántos por página (?perPage=50).
    @Query('isActive') isActive?: string,// filtro activo/inactivo (?isActive=true).
  ) {
    // Delegamos al servicio. Pasamos SIEMPRE el tenantId del usuario para que la
    // consulta quede aislada a su negocio (multi-tenant).
    return this.rewardsService.findAll(req.user.tenantId, {
      // "page ? Number(page) : undefined": si vino page (texto no vacío), lo
      // convertimos a número con Number(...); si no vino, mandamos undefined
      // para que el servicio use su valor por defecto.
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      // Para isActive comparamos contra el texto 'true'. "isActive === 'true'"
      // es true solo si el texto es exactamente "true"; cualquier otra cosa da
      // false. Si el parámetro no vino (undefined), no aplicamos el filtro.
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  // ── GET /api/rewards/:id ──────────────────────────────────────────────────
  // Devuelve UNA recompensa por su id. Exige el permiso rewards.read.
  @Get(':id')
  @RequirePermissions('rewards.read')
  // @Param('id') toma el valor que venga en la posición :id de la URL.
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.rewardsService.findOne(req.user.tenantId, id);
  }

  // ── POST /api/rewards/gift ────────────────────────────────────────────────
  // Regala una recompensa a un cliente concreto (sin que gaste puntos). Exige
  // el permiso rewards.create. NOTA: se declara ANTES de @Post() genérico para
  // que la ruta "gift" no se confunda con un id.
  @Post('gift')
  @RequirePermissions('rewards.create')
  // @Body() dto: el cuerpo JSON validado contra GiftRewardDto (rewardId+clientId).
  giftReward(@Request() req: any, @Body() dto: GiftRewardDto) {
    return this.rewardsService.giftReward(
      req.user.tenantId,   // negocio del usuario (aislamiento multi-tenant).
      dto.rewardId,        // qué recompensa regalar.
      dto.clientId,        // a qué cliente.
      req.user.userId,     // quién la regaló (para la auditoría).
    );
  }

  // ── POST /api/rewards ─────────────────────────────────────────────────────
  // Crea una nueva recompensa. Exige el permiso rewards.create.
  @Post()
  @RequirePermissions('rewards.create')
  // @Body() dto: el cuerpo validado contra CreateRewardDto.
  create(@Request() req: any, @Body() dto: CreateRewardDto) {
    return this.rewardsService.create(
      req.user.tenantId,
      dto,
      req.user.userId, // autor de la creación (para auditoría).
    );
  }

  // ── PUT /api/rewards/:id ──────────────────────────────────────────────────
  // Actualiza una recompensa existente. Exige el permiso rewards.update.
  @Put(':id')
  @RequirePermissions('rewards.update')
  update(
    @Request() req: any,
    @Param('id') id: string,            // qué recompensa editar (de la URL).
    @Body() dto: UpdateRewardDto,       // cambios validados (todos opcionales).
  ) {
    return this.rewardsService.update(
      req.user.tenantId,
      id,
      dto,
      req.user.userId, // autor del cambio (para auditoría).
    );
  }

  // ── DELETE /api/rewards/:id ───────────────────────────────────────────────
  // "Borra" una recompensa (en realidad la desactiva). Exige rewards.delete.
  @Delete(':id')
  @RequirePermissions('rewards.delete')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.rewardsService.remove(
      req.user.tenantId,
      id,
      req.user.userId,
    );
  }

  // ── PUT /api/rewards/redemptions/:code/use ────────────────────────────────
  // Marca un cupón (identificado por su código) como USADO. Lo usa el negocio
  // cuando el cliente presenta su cupón. Exige el permiso rewards.update.
  @Put('redemptions/:code/use')
  @RequirePermissions('rewards.update')
  // @Param('code') toma el código del cupón desde la URL.
  markCouponUsed(@Request() req: any, @Param('code') code: string) {
    return this.rewardsService.markCouponUsed(
      req.user.tenantId,
      code,
      req.user.userId,
    );
  }

  // Valida un codigo publico de cupon (no consumio puntos del cliente).
  // Sirve para que el POS lo verifique antes de aplicarlo en una cita.
  // ── POST /api/rewards/validate-code ───────────────────────────────────────
  // Comprueba si un código de cupón es válido (vigente y con canjes disponibles)
  // SIN consumir nada. Exige solo el permiso de lectura rewards.read.
  @Post('validate-code')
  @RequirePermissions('rewards.read')
  // El body trae { code }. "body?.code" usa "?." (optional chaining): si body
  // llegara vacío/undefined, devuelve undefined en vez de provocar un error.
  validateCode(@Request() req: any, @Body() body: { code: string }) {
    return this.rewardsService.validateCode(req.user.tenantId, body?.code);
  }

  // Retira un cupón emitido (RewardRedemption). Solo si NO está USED.
  // Si fue canje con puntos, devuelve los puntos al cliente. Si fue regalo,
  // simplemente se elimina. Audit logueado.
  // ── DELETE /api/rewards/redemptions/:id ───────────────────────────────────
  // Retira un cupón YA emitido (la fila RewardRedemption), por su id. Exige el
  // permiso rewards.delete.
  @Delete('redemptions/:id')
  @RequirePermissions('rewards.delete')
  removeRedemption(@Request() req: any, @Param('id') id: string) {
    return this.rewardsService.removeRedemption(
      req.user.tenantId,
      id,
      req.user.userId,
    );
  }

  // Historial completo de cupones del tenant (RewardRedemptions) con filtros
  // para el dashboard de admin: status, origen (regalo vs canje), rangos de
  // fecha (creacion / expiracion), cliente, reward, y busqueda libre.
  // ── GET /api/rewards/redemptions/all ──────────────────────────────────────
  // Lista paginada de TODOS los cupones emitidos, con muchos filtros opcionales.
  // Exige el permiso rewards.read.
  @Get('redemptions/all')
  @RequirePermissions('rewards.read')
  listRedemptions(
    @Request() req: any,
    // Cada @Query lee un filtro de la URL; todos llegan como texto y opcionales.
    @Query('page') page?: string,            // página actual.
    @Query('perPage') perPage?: string,      // elementos por página.
    @Query('status') status?: string,        // ACTIVE | USED | EXPIRED.
    @Query('source') source?: string,        // GIFT (regalo) | REDEEM (canje).
    @Query('expiresFrom') expiresFrom?: string, // expira desde esta fecha.
    @Query('expiresTo') expiresTo?: string,     // expira hasta esta fecha.
    @Query('createdFrom') createdFrom?: string, // creado desde esta fecha.
    @Query('createdTo') createdTo?: string,     // creado hasta esta fecha.
    @Query('clientId') clientId?: string,    // filtrar por un cliente concreto.
    @Query('rewardId') rewardId?: string,    // filtrar por una recompensa concreta.
    @Query('search') search?: string,        // búsqueda libre (nombre/email/código).
  ) {
    return this.rewardsService.listRedemptions(req.user.tenantId, {
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      status,
      // "source === 'GIFT' || source === 'REDEEM' ? source : undefined":
      // solo aceptamos esos dos valores exactos; cualquier otra cosa (o nada)
      // se convierte en undefined para no aplicar el filtro. El "||" significa
      // "o": basta con que UNA de las dos comparaciones sea verdadera.
      source: source === 'GIFT' || source === 'REDEEM' ? source : undefined,
      expiresFrom,
      expiresTo,
      createdFrom,
      createdTo,
      clientId,
      rewardId,
      search,
    });
  }

}
