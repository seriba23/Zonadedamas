// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Decoradores de validación de "class-validator" (validan el JSON entrante):
//   - IsDateString: debe ser un texto con formato de fecha (ISO).
//   - IsOptional: la propiedad puede faltar (es opcional).
//   - IsUUID: debe ser un UUID (id con guiones).
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

// DTO del endpoint POST /availability/bundle: disponibilidad de un "paquete"
// (bundle) de servicios que pueden hacer varios empleados encadenados.
export class BundleAvailabilityQueryDto {
  // bundleId: id del paquete a consultar (obligatorio, UUID v4).
  @IsUUID('4')
  bundleId: string;

  // locationId: id de la sucursal (opcional). El "?" lo marca como opcional.
  @IsOptional()
  @IsUUID('4')
  locationId?: string;

  // startDate: primer día del rango de búsqueda (ej. "2026-06-23").
  @IsDateString()
  startDate: string;

  // endDate: último día del rango de búsqueda.
  @IsDateString()
  endDate: string;
}
