// Decoradores de validación: IsOptional (campo opcional) e IsString (texto).
import { IsOptional, IsString } from 'class-validator';
// PaginationDto = DTO base con los campos de paginación (page, perPage). Lo
// importamos para HEREDAR de él y así reutilizar esa funcionalidad.
import { PaginationDto } from '../../../common/dto/pagination.dto';

// DTO para FILTRAR el historial (logs) de notificaciones enviadas.
// "extends PaginationDto" = ADEMÁS de los filtros de abajo, hereda page y
// perPage, porque los logs pueden ser muchos y se devuelven paginados.
export class FilterLogsDto extends PaginationDto {
  // eventName = filtra por el nombre del evento que generó la notificación
  // (ej. "payment.completed"). Opcional, de tipo texto.
  @IsOptional()
  @IsString()
  eventName?: string;

  // channel = filtra por canal usado (ej. "EMAIL" o "WHATSAPP"). Opcional, texto.
  @IsOptional()
  @IsString()
  channel?: string;

  // status = filtra por el resultado del envío (ej. "SENT" o "FAILED").
  // Opcional, de tipo texto.
  @IsOptional()
  @IsString()
  status?: string;
}
