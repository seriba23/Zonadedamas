// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
// De class-validator:
//   - IsArray: exige que el valor sea un arreglo (lista).
//   - IsBoolean: exige true/false.
//   - IsDateString: exige una fecha en formato texto ISO (ej. "2026-06-23").
//   - IsEnum: exige que el valor sea uno de los de un enum.
//   - IsOptional: la propiedad puede venir o no.
//   - IsString: exige texto.
//   - Matches: exige que el texto coincida con una expresión regular (patrón).
//   - ValidateNested: valida también los objetos DENTRO de un arreglo/objeto.
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
// "Type" de class-transformer: indica de qué CLASE son los objetos de un
// arreglo, para que ValidateNested sepa qué reglas aplicarles al transformar
// el JSON entrante en instancias de esa clase.
import { Type } from 'class-transformer';

// enum con los 7 días de la semana, en inglés y mayúsculas (igual que en la BD).
export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

// DTO de UN renglón de horario: representa cómo trabaja el empleado en un día.
export class ScheduleItemDto {
  // dayOfWeek: el día de la semana. Obligatorio; debe ser uno del enum.
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  // isWorking: si ese día trabaja o no. Obligatorio, true/false.
  @IsBoolean()
  isWorking: boolean;

  // startTime: hora de entrada. Opcional, texto. @Matches exige el formato
  // "HH:MM" de 24 horas mediante la expresión regular:
  //   ^([0-1]\d|2[0-3])  -> horas: 00-19 (0/1 + dígito) o 20-23
  //   :([0-5]\d)$        -> ":" + minutos 00-59
  // Si no encaja, devuelve el mensaje en español indicado.
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]\d|2[0-3]):([0-5]\d)$/, {
    message: 'La hora de inicio debe estar en formato HH:MM',
  })
  startTime?: string;

  // endTime: hora de salida. Mismo patrón "HH:MM" que startTime. Opcional.
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]\d|2[0-3]):([0-5]\d)$/, {
    message: 'La hora de fin debe estar en formato HH:MM',
  })
  endTime?: string;

  // effectiveFrom: fecha desde la que aplica este horario. Obligatorio, fecha ISO.
  @IsDateString()
  effectiveFrom: string;

  // effectiveUntil: fecha hasta la que aplica (si el horario tiene caducidad).
  // Opcional; si viene, fecha ISO.
  @IsOptional()
  @IsDateString()
  effectiveUntil?: string;
}

// DTO contenedor: el body para fijar el horario completo de un empleado trae un
// arreglo de renglones (uno por día).
export class SetSchedulesDto {
  // schedules: debe ser un arreglo (@IsArray). @ValidateNested({ each: true })
  // valida cada elemento del arreglo. @Type(() => ScheduleItemDto) dice que
  // cada elemento es un ScheduleItemDto (para aplicarle sus validaciones).
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  schedules: ScheduleItemDto[];
}
