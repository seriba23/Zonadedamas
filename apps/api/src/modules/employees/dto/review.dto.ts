// IMPORTS de class-validator:
//   - IsInt: exige un número entero.
//   - IsOptional: la propiedad puede venir o no.
//   - IsString: exige texto.
//   - IsUUID: exige un identificador UUID válido.
//   - Max / Min: exigen un valor máximo / mínimo (para números).
//   - MaxLength: exige una longitud máxima de caracteres.
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

// DTO para crear una reseña (review) de un empleado hecha por un cliente.
export class CreateReviewDto {
  // rating (calificación): número entero obligatorio entre 1 y 5 (Min 1, Max 5).
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  // comment (comentario): opcional, texto, máximo 1000 caracteres.
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  // appointmentId: la cita a la que pertenece la reseña. Obligatorio, UUID.
  @IsUUID()
  appointmentId: string;

  // clientId: el cliente que escribe la reseña. Obligatorio, UUID.
  @IsUUID()
  clientId: string;
}
