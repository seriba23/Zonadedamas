// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De la librería "class-validator" importamos el decorador IsUUID.
//   - Un "DTO" (Data Transfer Object) es una clase que describe la FORMA que debe
//     tener el JSON que llega en el cuerpo (body) de una petición.
//   - Los decoradores "@..." que ponemos sobre cada campo son REGLAS de
//     validación: NestJS (con su ValidationPipe) revisa el JSON entrante y, si
//     algún campo no cumple la regla, rechaza la petición con un error 400 antes
//     de que llegue al controlador. Así nunca trabajamos con datos inválidos.
//   - IsUUID comprueba que el valor sea un UUID (identificador único universal,
//     ej. "550e8400-e29b-41d4-a716-446655440000"). El '4' indica la versión 4.
import { IsUUID } from 'class-validator';

/**
 * DTO para ASIGNAR un rol a un usuario.
 * Describe el JSON que el frontend envía en POST /api/user-roles, por ejemplo:
 *   { "userId": "...uuid...", "roleId": "...uuid..." }
 */
export class AssignRoleDto {
  // @IsUUID('4') => userId debe ser un UUID v4 válido. Identifica al USUARIO
  // (la persona) al que se le va a dar el rol.
  @IsUUID('4')
  userId: string;

  // @IsUUID('4') => roleId debe ser un UUID v4 válido. Identifica el ROL
  // (el conjunto de permisos) que se le asignará a ese usuario.
  @IsUUID('4')
  roleId: string;
}
