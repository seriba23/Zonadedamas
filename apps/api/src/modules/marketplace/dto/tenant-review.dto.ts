// Decoradores de validación: IsInt (entero), IsOptional (opcional),
// IsString (texto), Max/Min (valor máximo/mínimo), MaxLength (longitud máxima).
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
// Type: de class-transformer, convierte el dato recibido al tipo indicado
// (aquí, transforma el texto de la petición en número antes de validarlo).
import { Type } from 'class-transformer';

/**
 * DTO para crear una reseña de un NEGOCIO (tenant): una calificación de 1 a 5
 * estrellas y un comentario opcional.
 */
export class CreateTenantReviewDto {
  @Type(() => Number) // convierte el valor a número (ej. "5" -> 5)
  @IsInt()            // debe ser un número entero
  @Min(1)             // mínimo 1 estrella
  @Max(5)             // máximo 5 estrellas
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(500) // como mucho 500 caracteres
  comment?: string; // comentario opcional
}
