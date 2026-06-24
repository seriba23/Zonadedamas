// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Decoradores de validación:
//   - IsBooleanString: el valor debe ser el TEXTO "true" o "false" (los query
//     params de la URL siempre llegan como texto, no como booleano real).
//   - IsEnum: el valor debe estar dentro de un conjunto cerrado de opciones.
//   - IsOptional / IsString / IsUUID: ya explicados en otros DTOs.
import { IsBooleanString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
// PaginationDto trae los campos comunes de paginación (page, perPage). Heredamos
// de él con "extends" para no repetir esos campos en cada filtro.
import { PaginationDto } from '../../../common/dto/pagination.dto';

// DTO de FILTROS para listar citas. "extends PaginationDto" significa que, además
// de los campos de abajo, también acepta page y perPage (heredados).
export class FilterAppointmentsDto extends PaginationDto {
  // Filtrar por sucursal (opcional, UUID).
  @IsOptional()
  @IsUUID()
  locationId?: string;

  // Filtrar por UN empleado (opcional, UUID).
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  // CSV de UUIDs ("id1,id2"). Si está presente, tiene prioridad sobre employeeId.
  // Permite filtrar por VARIOS empleados a la vez (la vista de calendario lo usa).
  @IsOptional()
  @IsString()
  employeeIds?: string;

  // Filtrar por cliente (opcional, UUID).
  @IsOptional()
  @IsUUID()
  clientId?: string;

  // Filtrar por estado de la cita. Solo se aceptan estos valores (IsEnum).
  @IsOptional()
  @IsEnum(['PENDING', 'CONFIRMED', 'RESCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
  status?: string;

  // Fecha de inicio del rango a consultar (opcional, texto). Puede ser solo
  // fecha (YYYY-MM-DD) o un ISO completo; el servicio decide cómo interpretarla.
  @IsOptional()
  @IsString()
  startDate?: string; // ISO date

  // Fecha de fin del rango (opcional, texto).
  @IsOptional()
  @IsString()
  endDate?: string; // ISO date

  // Si "true", devuelve citas con pendingPosPayment=true ignorando el filtro
  // de fechas. Usado por /pos para listar lo "Por cobrar" de cualquier día.
  @IsOptional()
  @IsBooleanString()
  pendingPosPayment?: string;
}
