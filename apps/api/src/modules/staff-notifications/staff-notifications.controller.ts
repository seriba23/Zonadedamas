// Decoradores de NestJS para declarar endpoints HTTP (cada uno es una "etiqueta @"):
//   - Body: lee el cuerpo (JSON) de un POST.
//   - Controller: marca la clase como grupo de endpoints.
//   - Get / Post: marcan un método como endpoint GET o POST.
//   - Param: lee un trozo variable de la URL (ej. el :id).
//   - Query: lee parámetros de la query string (ej. ?page=2).
//   - UseGuards: aplica "guardias" (controles de acceso) al endpoint o clase.
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
// JwtAuthGuard: guardia que exige un token JWT válido (usuario autenticado).
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
// CurrentUser: decorador propio que extrae el usuario ya autenticado del
// request (lo rellena el guard) y lo entrega como parámetro del método.
import { CurrentUser } from '../../common/decorators/current-user.decorator';
// El servicio con la lógica real; el controlador solo recibe y delega.
import { StaffNotificationsService } from './staff-notifications.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { SubscribePushDto } from './dto/subscribe-push.dto';

// @Controller('staff-notifications') => todas las rutas empiezan con
// "/api/staff-notifications" (el prefijo "/api" se agrega globalmente).
// @UseGuards(JwtAuthGuard) a NIVEL DE CLASE => TODOS los endpoints de aquí
// requieren estar autenticado (token JWT válido).
@Controller('staff-notifications')
@UseGuards(JwtAuthGuard)
export class StaffNotificationsController {
  // NestJS inyecta el servicio; lo guardamos como this.service (solo lectura).
  constructor(private readonly service: StaffNotificationsService) {}

  // ── GET /api/staff-notifications?page=&perPage=&section=&unreadOnly= ────────
  // Lista las notificaciones del usuario actual con filtros.
  @Get()
  list(@CurrentUser() user: any, @Query() filters: ListNotificationsDto) {
    // user.userId = id del usuario sacado del token. Lo pasamos al servicio
    // junto con los filtros de la query.
    return this.service.list(user.userId, filters);
  }

  // ── GET /api/staff-notifications/unread-counts ─────────────────────────────
  // Devuelve el conteo de no leídas por sección (para los badges del menú).
  @Get('unread-counts')
  unreadCounts(@CurrentUser() user: any) {
    return this.service.unreadCounts(user.userId);
  }

  // ── GET /api/staff-notifications/vapid-public-key ──────────────────────────
  // Entrega la clave PÚBLICA VAPID al frontend (la necesita el navegador para
  // suscribirse a push). "?? null": si la variable no existe, devuelve null.
  @Get('vapid-public-key')
  vapidPublicKey() {
    return { data: { key: process.env.VAPID_PUBLIC_KEY ?? null } };
  }

  // ── POST /api/staff-notifications/:id/read ─────────────────────────────────
  // Marca como leída la notificación cuyo id viene en la URL.
  @Post(':id/read')
  markRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.markRead(user.userId, id);
  }

  // ── POST /api/staff-notifications/read-all ─────────────────────────────────
  // Marca como leídas todas (o las de una sección, si viene en el body).
  @Post('read-all')
  markAllRead(
    @CurrentUser() user: any,
    @Body() body: { section?: string },
  ) {
    // "body?.section": el "?." evita romper si body llegara vacío; en ese caso
    // pasa undefined y el servicio marcará todas las secciones.
    return this.service.markAllRead(user.userId, body?.section);
  }

  // ── POST /api/staff-notifications/push/subscribe ───────────────────────────
  // Registra la suscripción push del navegador del usuario. El cuerpo se valida
  // automáticamente contra SubscribePushDto.
  @Post('push/subscribe')
  subscribePush(@CurrentUser() user: any, @Body() dto: SubscribePushDto) {
    return this.service.subscribePush(user.userId, dto);
  }

  // ── POST /api/staff-notifications/push/unsubscribe ─────────────────────────
  // Cancela la suscripción push (recibe el endpoint a borrar en el body).
  @Post('push/unsubscribe')
  unsubscribePush(
    @CurrentUser() user: any,
    @Body() body: { endpoint: string },
  ) {
    return this.service.unsubscribePush(user.userId, body.endpoint);
  }
}
