// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Decoradores de validación de "class-validator" (validan el JSON entrante):
//   - IsArray: debe ser un arreglo (lista).
//   - IsDateString: debe ser un texto con formato de fecha/hora (ISO).
//   - IsUUID: debe ser un UUID (id con guiones).
import { IsArray, IsDateString, IsUUID } from 'class-validator';

// DTO del endpoint POST /availability/check-after: comprueba si un empleado
// puede atender los servicios pedidos JUSTO DESPUÉS de cierta hora (afterTime),
// y si no, busca el siguiente hueco disponible.
export class CheckAfterDto {
  // employeeId: id del empleado a comprobar (obligatorio, UUID v4).
  @IsUUID('4')
  employeeId: string;

  // serviceIds: lista de ids de servicios. "each: true" valida cada elemento
  // del arreglo como UUID v4 por separado.
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];

  // afterTime: la fecha-hora a partir de la cual buscar disponibilidad
  // (texto ISO, ej. "2026-06-23T15:30:00Z").
  @IsDateString()
  afterTime: string;
}
