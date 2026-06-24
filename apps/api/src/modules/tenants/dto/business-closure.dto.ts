// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: decoradores de validación para los "cierres" del negocio
// (días en que el negocio no abre: vacaciones, feriados, etc.).
// ─────────────────────────────────────────────────────────────────────────────
//   - IsDateString: el valor debe ser una fecha en texto ISO (ej. "2026-06-23").
//   - IsNotEmpty: el valor no puede estar vacío.
//   - IsOptional: el campo puede venir o no.
//   - IsString: el valor debe ser texto.
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// DTO para CREAR un cierre: el rango de fechas y el motivo.
export class CreateBusinessClosureDto {
  // Fecha de inicio del cierre (texto de fecha, ej. "2026-12-24").
  @IsDateString()
  startDate: string;

  // Fecha de fin del cierre (texto de fecha).
  @IsDateString()
  endDate: string;

  // Motivo del cierre. Debe ser texto y no estar vacío.
  @IsNotEmpty()
  @IsString()
  reason: string;
}

// DTO para FILTRAR cierres al consultarlos. Ambas fechas son opcionales: si no
// vienen, se devuelven todos los cierres; si vienen, se filtra por ese rango.
export class ClosureQueryDto {
  // Inicio del rango a consultar (opcional, texto de fecha).
  @IsOptional()
  @IsDateString()
  startDate?: string;

  // Fin del rango a consultar (opcional, texto de fecha).
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
