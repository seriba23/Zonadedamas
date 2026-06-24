// De class-validator importamos "decoradores de validación": etiquetas "@" que
// se ponen sobre cada campo y verifican AUTOMÁTICAMENTE que el dato recibido
// cumpla la regla. Si no cumple, NestJS rechaza la petición con error 400.
//   - IsBoolean: el valor debe ser true/false.
//   - IsOptional: el campo puede venir o no (si falta, no se valida lo demás).
//   - IsString: el valor debe ser texto.
import { IsBoolean, IsOptional, IsString } from 'class-validator';

// DTO (Data Transfer Object) = "molde" que describe y valida los datos que llega
// del cliente. Este es para ACTUALIZAR una plantilla de notificación: todos sus
// campos son opcionales, porque se puede editar solo una parte (actualización
// parcial).
export class UpdateTemplateDto {
  // subject = el asunto del correo. Opcional y, si viene, debe ser texto.
  @IsOptional()
  @IsString()
  subject?: string;

  // bodyTemplate = el cuerpo de la plantilla (con variables tipo {{nombre}}).
  // Opcional; si viene, debe ser texto.
  @IsOptional()
  @IsString()
  bodyTemplate?: string;

  // isActive = si la plantilla está activa (se envía) o no. Opcional; si viene,
  // debe ser un booleano (true/false).
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
