// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// "Type" de class-transformer sirve para indicarle al validador qué CLASE tiene
// cada elemento de un arreglo anidado. Sin esto, los objetos dentro del arreglo
// llegan como objetos planos y @ValidateNested no sabría con qué reglas validarlos.
import { Type } from 'class-transformer';
// Decoradores de validación de class-validator:
//   - ArrayMinSize: el arreglo debe tener al menos N elementos.
//   - IsArray: debe ser un arreglo (lista).
//   - IsDateString: debe ser un texto con formato de fecha (ISO).
//   - IsOptional: la propiedad puede faltar.
//   - IsUUID: debe ser un UUID.
//   - ValidateNested: valida los objetos ANIDADOS dentro del arreglo usando sus
//     propios decoradores (los de ServiceAssignmentDto).
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

// Sub-DTO: cada "asignación" empareja UN servicio con UN empleado concreto.
// Se usa en el flujo del marketplace donde el cliente, cuando varios
// profesionales pueden hacer el mismo servicio, elige quién hace cada uno.
export class ServiceAssignmentDto {
  // serviceId: id del servicio (UUID v4).
  @IsUUID('4')
  serviceId: string;

  // employeeId: id del empleado asignado a ESE servicio (UUID v4).
  @IsUUID('4')
  employeeId: string;
}

// DTO del endpoint POST /availability/composite: disponibilidad cuando cada
// servicio tiene un empleado fijo asignado (varios servicios encadenados).
export class CompositeAvailabilityQueryDto {
  // locationId: id de la sucursal (opcional).
  @IsOptional()
  @IsUUID('4')
  locationId?: string;

  // serviceAssignments: lista de pares {servicio, empleado}.
  //   - @IsArray(): debe ser una lista.
  //   - @ArrayMinSize(1): debe tener al menos 1 elemento.
  //   - @ValidateNested({ each: true }): valida CADA objeto del arreglo con las
  //     reglas de su clase.
  //   - @Type(() => ServiceAssignmentDto): le dice al validador que cada
  //     elemento es un ServiceAssignmentDto (para saber qué reglas aplicar).
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ServiceAssignmentDto)
  serviceAssignments: ServiceAssignmentDto[];

  // startDate: primer día del rango de búsqueda (ej. "2026-06-23").
  @IsDateString()
  startDate: string;

  // endDate: último día del rango de búsqueda.
  @IsDateString()
  endDate: string;
}
