// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Decoradores de validación de "class-validator" (ver explicación general en los
// otros DTOs). NestJS los usa para validar el JSON entrante automáticamente.
//   - IsArray: debe ser un arreglo (lista).
//   - IsDateString: debe ser un texto con formato de fecha (ISO, ej. "2026-06-23").
//   - IsOptional: la propiedad puede faltar (es opcional). Si no viene, no se
//     valida; si viene, sí se aplican las demás reglas.
//   - IsString: debe ser un texto.
//   - IsUUID: debe ser un UUID (id con guiones).
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

// DTO del endpoint principal POST /availability/query: pide los slots libres
// dentro de un rango de fechas, para uno o varios empleados, para uno o varios
// servicios.
export class AvailabilityQueryDto {
  // locationId: id de la sucursal (opcional). El "?" en "locationId?" indica que
  // la propiedad puede no venir. @IsOptional permite que falte.
  @IsOptional()
  @IsUUID('4')
  locationId?: string;

  // serviceIds: lista (obligatoria) de ids de servicios a reservar.
  // "each: true" valida que CADA elemento del arreglo sea un UUID v4.
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];

  // employeeId: id de un empleado concreto (opcional). Si no viene, el servicio
  // buscará entre todos los empleados que ofrezcan los servicios pedidos.
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  // startDate: primer día del rango a consultar (ej. "2026-06-23").
  @IsDateString()
  startDate: string;

  // endDate: último día del rango a consultar.
  @IsDateString()
  endDate: string;

  // timezone: zona horaria (opcional). Debe ser un texto si viene.
  @IsOptional()
  @IsString()
  timezone?: string;
}
