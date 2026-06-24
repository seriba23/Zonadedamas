// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
// De class-validator:
//   - IsDateString: exige una fecha en formato texto ISO.
//   - IsIn: exige que el valor esté DENTRO de una lista concreta de valores.
//   - IsOptional: la propiedad puede venir o no.
//   - IsString: exige texto.
//   - IsArray: exige un arreglo.
//   - ValidateNested: valida los objetos dentro de un arreglo/objeto.
//   - IsNumber: exige un número.
//   - Min: exige un valor mínimo (para números).
import { IsDateString, IsIn, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
// "Type" de class-transformer: indica la clase de los elementos de un arreglo
// para que ValidateNested aplique sus validaciones.
import { Type } from 'class-transformer';

// DTO para registrar tiempo libre (vacaciones, permiso, etc.) de un empleado.
export class CreateTimeOffDto {
  // startDatetime: fecha-hora de inicio del descanso. Obligatorio, fecha ISO.
  @IsDateString()
  startDatetime: string;

  // endDatetime: fecha-hora de fin del descanso. Obligatorio, fecha ISO.
  @IsDateString()
  endDatetime: string;

  // reason (motivo): opcional, texto.
  @IsOptional()
  @IsString()
  reason?: string;

  // status: opcional; si viene, debe ser 'PENDING' o 'APPROVED' (IsIn limita
  // los valores aceptados). El tipo "'PENDING' | 'APPROVED'" es un "union type":
  // solo admite una de esas dos cadenas exactas.
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED'])
  status?: 'PENDING' | 'APPROVED';
}

// DTO para rechazar una solicitud de tiempo libre: requiere un motivo.
export class RejectTimeOffDto {
  // rejectionReason (motivo del rechazo): obligatorio, texto.
  @IsString()
  rejectionReason: string;
}

// DTO de configuración de UN servicio para un empleado (precio/comisión propios).
export class ServiceConfigDto {
  // serviceId: el servicio que se configura. Obligatorio, texto.
  @IsString()
  serviceId: string;

  // commission (comisión): opcional, número, mínimo 0 (no puede ser negativa).
  @IsOptional()
  @IsNumber()
  @Min(0)
  commission?: number;

  // 'AMOUNT' (default) o 'PERCENT'. Si viene PERCENT, el valor de
  // commission se interpreta como % del precio del servicio.
  // commissionType: opcional, texto. El union type limita a 'AMOUNT' | 'PERCENT'.
  @IsOptional()
  @IsString()
  commissionType?: 'AMOUNT' | 'PERCENT';

  // customPrice (precio personalizado): opcional, número, mínimo 0. Permite que
  // este empleado cobre un precio distinto al del servicio por defecto.
  @IsOptional()
  @IsNumber()
  @Min(0)
  customPrice?: number;
}

// DTO contenedor: el body para fijar los servicios de un empleado trae un
// arreglo de configuraciones (una por servicio).
export class SetServicesDto {
  // services: arreglo (@IsArray) donde cada elemento se valida
  // (@ValidateNested each:true) como un ServiceConfigDto (@Type).
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceConfigDto)
  services: ServiceConfigDto[];
}
