// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De "class-validator" importamos "decoradores de validación". Son etiquetas que
// se ponen sobre cada propiedad de la clase y NestJS las usa para comprobar
// AUTOMÁTICAMENTE que el cuerpo (JSON) que envía el cliente cumple las reglas.
// Si algo no cumple, NestJS responde con error 400 (Bad Request) antes de que el
// código del controlador siquiera se ejecute.
//   - IsArray: la propiedad debe ser un arreglo (lista).
//   - IsDateString: la propiedad debe ser un texto con formato de fecha (ISO).
//   - IsUUID: la propiedad debe ser un UUID (identificador único con guiones).
import {
  IsArray,
  IsDateString,
  IsUUID,
} from 'class-validator';

// Un DTO ("Data Transfer Object") es solo una clase que describe la FORMA que
// debe tener el cuerpo de una petición. Este DTO valida la entrada del endpoint
// POST /availability/all-slots (todos los slots de UN empleado en UN día).
export class AllSlotsQueryDto {
  // date: la fecha consultada (ej. "2026-06-23"). Debe ser un texto de fecha.
  @IsDateString()
  date: string;

  // employeeId: el id del empleado. @IsUUID('4') exige un UUID de versión 4.
  @IsUUID('4')
  employeeId: string;

  // serviceIds: lista de ids de servicios que el cliente quiere reservar.
  //   - @IsArray() asegura que sea una lista.
  //   - @IsUUID('4', { each: true }) => el "each: true" aplica la regla a CADA
  //     elemento del arreglo (cada elemento debe ser un UUID v4).
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];
}
