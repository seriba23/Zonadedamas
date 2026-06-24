// Decoradores de validación: IsOptional (el campo puede faltar) e IsString
// (si viene, debe ser texto).
import { IsOptional, IsString } from 'class-validator';

// DTO para FILTRAR la lista de plantillas. Llega en la query string de la URL
// (ej. ?eventTrigger=appointment.created&type=EMAIL). Ambos filtros son
// opcionales: si no se mandan, se devuelven todas las plantillas.
export class FilterTemplatesDto {
  // eventTrigger = el evento que dispara la plantilla (ej. "appointment.created").
  // Filtra por ese disparador. Opcional y de tipo texto.
  @IsOptional()
  @IsString()
  eventTrigger?: string;

  // type = el canal/tipo de la plantilla (ej. "EMAIL" o "WHATSAPP"). Opcional y
  // de tipo texto.
  @IsOptional()
  @IsString()
  type?: string;
}
