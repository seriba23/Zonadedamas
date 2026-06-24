// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos "piezas" de otras librerías para poder usarlas aquí.
// ─────────────────────────────────────────────────────────────────────────────

// De NestJS importamos los "decoradores" que sirven para declarar endpoints.
// Un decorador es una etiqueta que empieza con "@" y se pone arriba de una clase
// o método para darle un comportamiento extra.
//   - Controller: marca una clase como "controlador" (un grupo de endpoints).
//   - Get / Post / Delete: marcan un método como endpoint que responde a ese
//     verbo HTTP (leer, crear, borrar/desactivar).
//   - Param: lee un trozo de la URL (ej. el :id de /invite-codes/:id).
//   - Body: lee el cuerpo (JSON) que el cliente envía en un POST.
//   - UseGuards: aplica "guardias" (controles de seguridad) al controlador.
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';

// El "servicio" con la lógica real (crear/listar/desactivar códigos). El
// controlador solo recibe la petición HTTP y se la pasa al servicio.
import { InviteCodesService } from './invite-codes.service';

// JwtAuthGuard = guardia que exige que el usuario esté autenticado (que envíe un
// token JWT válido). Sin él, la petición se rechaza con 401.
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// PermissionGuard = guardia que, además, comprueba que el usuario tenga el
// permiso necesario (declarado con @RequirePermissions).
import { PermissionGuard } from '../../common/guards/permission.guard';

// RequirePermissions = decorador para indicar QUÉ permiso hace falta en cada
// endpoint (formato "modulo.accion", p. ej. "tenant.update").
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

// CurrentUser = decorador que extrae del token al usuario que hace la petición.
// JwtPayload = el "tipo" (forma) de esos datos del usuario (incluye tenantId).
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

// Decoradores de "class-validator" para validar automáticamente el cuerpo (DTO):
//   - IsOptional   : el campo puede no venir.
//   - IsInt        : si viene, debe ser un número entero.
//   - Min          : valor mínimo permitido.
//   - IsDateString : debe ser una fecha en texto ISO (ej. "2026-06-30").
//   - IsString     : debe ser texto.
//   - IsArray      : debe ser una lista (arreglo).
import { IsOptional, IsInt, Min, IsDateString, IsString, IsArray } from 'class-validator';

/**
 * DTO ("Data Transfer Object") = la forma esperada del cuerpo (JSON) al CREAR un
 * código. Cada propiedad lleva sus decoradores de validación encima. Si el JSON
 * no cumple las reglas, NestJS responde 400 automáticamente, antes de entrar al
 * método del controlador.
 */
class CreateInviteCodeDto {
  // Puesto sugerido para el empleado. Opcional y, si viene, debe ser texto.
  @IsOptional()
  @IsString()
  jobTitle?: string;

  // Lista de ids de servicios. Opcional y, si viene, debe ser un arreglo.
  @IsOptional()
  @IsArray()
  serviceIds?: string[];

  // Máximo de usos del código. Opcional; si viene, entero y mínimo 0
  // (0 = ilimitado).
  @IsOptional()
  @IsInt()
  @Min(0)
  maxUses?: number;

  // Fecha de caducidad. Opcional; si viene, debe ser una fecha en texto ISO.
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

// @Controller('invite-codes') => todas las rutas de esta clase empiezan con
// "/api/invite-codes". (El prefijo "/api" se agrega globalmente en otra parte.)
@Controller('invite-codes')
// @UseGuards aplica AMBAS guardias a TODOS los endpoints de esta clase: primero
// exige login (JwtAuthGuard) y luego comprueba permisos (PermissionGuard).
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InviteCodesController {
  // CONSTRUCTOR + INYECCIÓN DE DEPENDENCIAS:
  // NestJS crea una instancia del servicio y nos la "inyecta" aquí. El
  // "private readonly" la guarda como propiedad (this.inviteCodesService) que no
  // se puede reasignar.
  constructor(private readonly inviteCodesService: InviteCodesService) {}

  // ── POST /api/invite-codes ────────────────────────────────────────────────
  // Crea un nuevo código de invitación para el negocio del usuario actual.
  @Post()
  // Exige el permiso "tenant.update": solo quien puede editar el negocio puede
  // generar códigos de invitación.
  @RequirePermissions('tenant.update')
  async create(
    // @CurrentUser() inyecta los datos del usuario autenticado (de su token).
    @CurrentUser() user: JwtPayload,
    // @Body() lee el JSON enviado y lo valida contra CreateInviteCodeDto.
    @Body() dto: CreateInviteCodeDto,
  ) {
    // Llamamos al servicio pasándole los datos. Tomamos el tenantId del usuario
    // (NO del cuerpo) para garantizar que el código se cree en SU negocio.
    const result = await this.inviteCodesService.create(
      user.tenantId,
      dto.jobTitle,
      dto.serviceIds,
      dto.maxUses,
      // Operador ternario: condición ? siVerdadero : siFalso.
      // Si vino expiresAt (texto), lo convertimos a un objeto Date real con
      // "new Date(...)". Si no vino, pasamos "undefined" (sin caducidad).
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    );
    // Respondemos con el formato estándar del proyecto: { data: ... }.
    return { data: result };
  }

  // ── GET /api/invite-codes ─────────────────────────────────────────────────
  // Lista los códigos activos del negocio del usuario actual.
  @Get()
  @RequirePermissions('tenant.update')
  async findAll(@CurrentUser() user: JwtPayload) {
    // Pedimos al servicio los códigos del negocio del usuario (su tenantId).
    const result = await this.inviteCodesService.findAll(user.tenantId);
    return { data: result };
  }

  // ── DELETE /api/invite-codes/:id ──────────────────────────────────────────
  // Desactiva (no borra físicamente) un código por su id.
  @Delete(':id')
  @RequirePermissions('tenant.update')
  async deactivate(
    // @Param('id') toma el valor que venga en la posición :id de la URL.
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Pasamos también el tenantId del usuario para que solo pueda desactivar
    // códigos de SU propio negocio (seguridad multi-tenant).
    await this.inviteCodesService.deactivate(id, user.tenantId);
    // Devolvemos un mensaje de confirmación en el formato estándar { data: ... }.
    return { data: { message: 'Código desactivado' } };
  }
}
