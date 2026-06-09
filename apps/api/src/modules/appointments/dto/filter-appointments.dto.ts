import { IsBooleanString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterAppointmentsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  // CSV de UUIDs ("id1,id2"). Si está presente, tiene prioridad sobre employeeId.
  @IsOptional()
  @IsString()
  employeeIds?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsEnum(['PENDING', 'CONFIRMED', 'RESCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
  status?: string;

  @IsOptional()
  @IsString()
  startDate?: string; // ISO date

  @IsOptional()
  @IsString()
  endDate?: string; // ISO date

  // Si "true", devuelve citas con pendingPosPayment=true ignorando el filtro
  // de fechas. Usado por /pos para listar lo "Por cobrar" de cualquier día.
  @IsOptional()
  @IsBooleanString()
  pendingPosPayment?: string;
}
