// ─────────────────────────────────────────────────────────────────────────────
// DTO para CREAR una RESEÑA. El cliente puede calificar al empleado (obligatorio)
// y, opcionalmente, también al negocio en la misma reseña ("dual review").
// ─────────────────────────────────────────────────────────────────────────────

// Decoradores de validación de "class-validator":
//   - IsInt: el valor debe ser un número entero.
//   - IsOptional: el campo puede faltar.
//   - IsString: el valor debe ser texto.
//   - Max / Min: el número debe estar dentro de un rango (aquí, de 1 a 5 estrellas).
//   - MaxLength: el texto no puede superar cierta cantidad de caracteres.
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// Cuerpo del POST /portal/:tenantSlug/appointments/:id/review.
export class CreateReviewDto {
  // Calificación del EMPLEADO: número entero OBLIGATORIO de 1 a 5.
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  // Comentario sobre el empleado: OPCIONAL, texto, máximo 1000 caracteres.
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  // Calificación del NEGOCIO: OPCIONAL, entero de 1 a 5 si se envía.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  businessRating?: number;

  // Comentario sobre el negocio: OPCIONAL, texto, máximo 1000 caracteres.
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  businessComment?: string;
}
