// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: estos DTO ("Data Transfer Object") describen la FORMA que deben
// tener los datos que llegan del cliente, y cada decorador "@" es una REGLA de
// validación que se comprueba automáticamente antes de ejecutar el endpoint.
// ─────────────────────────────────────────────────────────────────────────────

// De "class-validator" traemos los decoradores de validación:
//   - Allow: marca un campo como "permitido" (no lo valida, pero evita que se
//     elimine cuando el ValidationPipe usa whitelist).
//   - IsArray: exige que el valor sea un arreglo (lista).
//   - IsDateString: exige un texto con formato de fecha ISO (ej. "2026-06-24").
//   - IsEmail: exige que el texto tenga forma de correo electrónico.
//   - IsOptional: marca el campo como opcional (si no viene, no se valida).
//   - IsString: exige que el valor sea texto.
//   - IsUUID: exige que el texto sea un identificador único con forma UUID.
//   - ValidateNested: indica que el campo es OTRO objeto con sus propias reglas
//     y que también debe validarse "por dentro".
import {
  Allow,
  IsArray,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

// "Type" de class-transformer dice de qué CLASE es realmente un campo anidado.
// Sin esto, ValidateNested no sabría con qué reglas validar el objeto interno.
import { Type } from 'class-transformer';

// DTO de la consulta de disponibilidad pública: define qué manda el cliente
// cuando pregunta "¿qué horarios hay libres?" (POST /availability).
export class PublicAvailabilityQueryDto {
  // serviceIds debe ser un arreglo...
  @IsArray()
  // ...y CADA elemento del arreglo debe ser un UUID versión 4 ("each: true"
  // aplica la regla a cada ítem, no al arreglo completo).
  @IsUUID('4', { each: true })
  serviceIds: string[];

  // Fecha de inicio del rango a consultar, como texto ISO ("2026-06-24").
  @IsDateString()
  startDate: string;

  // Fecha de fin del rango, también como texto ISO.
  @IsDateString()
  endDate: string;

  // employeeId es opcional: si el cliente NO eligió profesional, se omite.
  @IsOptional()
  // Si viene, debe ser un UUID v4 válido.
  @IsUUID('4')
  // El "?" en "employeeId?" marca la propiedad como opcional en TypeScript.
  employeeId?: string;

  // locationId (sucursal) también opcional; si viene, debe ser UUID v4.
  @IsOptional()
  @IsUUID('4')
  locationId?: string;
}

// DTO de los datos del cliente que reserva. Se valida "anidado" dentro de
// PublicBookDto (ver más abajo el @ValidateNested + @Type).
export class PublicClientDto {
  // Nombre: texto obligatorio.
  @IsString()
  firstName: string;

  // Apellido: texto obligatorio.
  @IsString()
  lastName: string;

  // Correo: obligatorio y con forma de email. Es la CLAVE para el
  // "find-or-create" del cliente dentro del negocio (ver el servicio).
  @IsEmail()
  email: string;

  // Teléfono opcional; si viene, debe ser texto.
  @IsOptional()
  @IsString()
  phone?: string;
}

// DTO de la reserva (POST /book): todo lo necesario para crear la cita.
export class PublicBookDto {
  // Lista de servicios elegidos: arreglo de UUID v4 (cada elemento validado).
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];

  // Profesional elegido: un único UUID v4 obligatorio.
  @IsUUID('4')
  employeeId: string;

  // Hora de inicio de la cita como texto (ej. "2026-06-24T15:30:00").
  @IsString()
  startTime: string;

  // "client" es un objeto anidado: @ValidateNested obliga a validarlo por
  // dentro y @Type(() => PublicClientDto) dice qué clase/reglas usar para ello.
  @ValidateNested()
  @Type(() => PublicClientDto)
  client: PublicClientDto;

  // Notas libres del cliente (opcional); si vienen, deben ser texto.
  @IsOptional()
  @IsString()
  notes?: string;

  // serviceAssignments (opcional): cuando varios profesionales pueden hacer los
  // servicios, asocia cada serviceId con el employeeId elegido para ese servicio.
  // @Allow() lo deja pasar sin validar su estructura interna (validación libre).
  @IsOptional()
  @Allow()
  serviceAssignments?: Array<{ serviceId: string; employeeId: string }>;
}
