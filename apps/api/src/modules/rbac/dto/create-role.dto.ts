// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De "class-validator" importamos varios decoradores de validación. Cada uno es
// una etiqueta "@" que se pone sobre un campo de un DTO para exigir que el dato
// cumpla cierta regla. NestJS valida el JSON entrante con estas reglas y, si algo
// falla, responde 400 (petición inválida) antes de ejecutar la lógica.
//   - IsArray:   el valor debe ser una lista (arreglo).
//   - IsBoolean: el valor debe ser true/false. (Se importa aunque aquí no se use
//                en estos DTOs; lo dejamos tal cual para no alterar el código.)
//   - IsOptional: el campo PUEDE faltar; si no viene, no se validan sus otras
//                reglas. Marca el campo como opcional.
//   - IsString:  el valor debe ser texto (cadena).
//   - IsUUID:    el valor debe ser un UUID (identificador único universal).
//   - MinLength: el texto debe tener al menos N caracteres.
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

/**
 * DTO para CREAR un rol nuevo.
 * Describe el JSON que llega en POST /api/roles, por ejemplo:
 *   { "name": "Recepcionista", "description": "...", "permissionIds": ["...","..."] }
 */
export class CreateRoleDto {
  // name = nombre del rol. Es OBLIGATORIO (no lleva @IsOptional).
  // @IsString  => debe ser texto.
  // @MinLength(1) => debe tener al menos 1 carácter (no puede ir vacío "").
  @IsString()
  @MinLength(1)
  name: string;

  // description = descripción del rol. El "?" en "description?" lo marca como
  // opcional a nivel de TypeScript, y @IsOptional hace lo mismo en validación:
  // si viene, debe ser texto (@IsString); si no viene, no pasa nada.
  @IsOptional()
  @IsString()
  description?: string;

  // permissionIds = lista de IDs de permisos que tendrá el rol. Opcional.
  //   - @IsArray => si viene, debe ser una lista.
  //   - @IsUUID('4', { each: true }) => la opción "each: true" aplica la regla a
  //     CADA elemento de la lista, no a la lista entera. Es decir: cada elemento
  //     del arreglo debe ser, por sí mismo, un UUID v4 válido.
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}

/**
 * DTO para ACTUALIZAR un rol existente.
 * Casi idéntico a CreateRoleDto, pero aquí TODOS los campos son opcionales:
 * en una actualización el cliente puede enviar solo los campos que quiere cambiar
 * (por ejemplo, solo el "name"), dejando los demás como están.
 */
export class UpdateRoleDto {
  // name opcional: si se envía, debe ser texto de al menos 1 carácter.
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  // description opcional: si se envía, debe ser texto.
  @IsOptional()
  @IsString()
  description?: string;

  // permissionIds opcional: si se envía, lista donde cada elemento es un UUID v4.
  // Enviar este campo REEMPLAZA por completo los permisos del rol (ver el
  // servicio: borra los antiguos y crea los nuevos).
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}
