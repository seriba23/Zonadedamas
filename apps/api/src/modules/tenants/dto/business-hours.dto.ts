// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: decoradores de validación para describir los "horarios de negocio".
// ─────────────────────────────────────────────────────────────────────────────
//   - IsArray: el valor debe ser una lista (arreglo).
//   - IsBoolean: el valor debe ser true/false.
//   - IsEnum: el valor debe ser UNO de los permitidos en un enum (lista cerrada).
//   - IsString: el valor debe ser texto.
//   - Matches: el texto debe coincidir con un patrón (expresión regular).
//   - ValidateNested: valida las reglas de los objetos DENTRO de una lista.
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
// "Type": indica a qué clase convertir cada elemento de la lista anidada.
import { Type } from 'class-transformer';

// Un "enum" es una lista cerrada de valores válidos. Aquí definimos los días de
// la semana tal como los espera la base de datos (en inglés y mayúsculas).
// Solo se aceptarán estos 7 valores para "dayOfWeek".
enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

// DTO de UN renglón de horario: el horario de UN día concreto.
export class BusinessHourItemDto {
  // El día debe ser uno de los 7 valores del enum DayOfWeek.
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  // Hora de apertura. El patrón /^([0-1]\d|2[0-3]):([0-5]\d)$/ valida formato
  // "HH:mm" de 24 horas:
  //   - ([0-1]\d|2[0-3]) acepta las horas 00-19 (0/1 + dígito) o 20-23.
  //   - ":" el separador literal de dos puntos.
  //   - ([0-5]\d) acepta minutos 00-59.
  // Si no cumple, muestra el mensaje en español.
  @IsString()
  @Matches(/^([0-1]\d|2[0-3]):([0-5]\d)$/, {
    message: 'openTime debe estar en formato HH:mm',
  })
  openTime: string;

  // Hora de cierre, con el MISMO patrón "HH:mm" que la apertura.
  @IsString()
  @Matches(/^([0-1]\d|2[0-3]):([0-5]\d)$/, {
    message: 'closeTime debe estar en formato HH:mm',
  })
  closeTime: string;

  // ¿El negocio abre ese día? true = abierto, false = cerrado.
  @IsBoolean()
  isOpen: boolean;
}

// DTO que envuelve TODA la semana: una lista de renglones de horario.
export class SetBusinessHoursDto {
  // "hours" debe ser un arreglo. ValidateNested({ each: true }) significa
  // "valida CADA elemento de la lista" con las reglas de BusinessHourItemDto,
  // y @Type indica que cada elemento es de ese tipo.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessHourItemDto)
  hours: BusinessHourItemDto[];
}
