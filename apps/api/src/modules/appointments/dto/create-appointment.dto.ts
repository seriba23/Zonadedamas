// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Decoradores de validación de "class-validator". Validan el JSON que llega:
//   - IsArray: el valor debe ser una lista ([...]).
//   - IsEnum: el valor debe ser uno de un conjunto cerrado de opciones.
//   - IsOptional: el campo puede faltar.
//   - IsString: el valor debe ser texto.
//   - IsUUID: el valor debe ser un identificador con formato UUID.
//   - ValidateNested: valida también los objetos DENTRO de una lista/propiedad
//     (es decir, valida en profundidad, no solo el nivel de arriba).
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
// "Type" (de class-transformer) le dice al validador de qué CLASE es cada
// elemento de una lista anidada, para poder construirlo y validarlo bien.
import { Type } from 'class-transformer';

// Sub-objeto que empareja un servicio con el empleado que lo realizará. Se usa
// en citas "multi-empleado" (un paquete donde cada servicio lo hace una persona).
export class ServiceAssignment {
  // ID del servicio (debe ser UUID).
  @IsUUID()
  serviceId: string;

  // ID del empleado asignado a ese servicio (debe ser UUID).
  @IsUUID()
  employeeId: string;
}

// DTO principal para CREAR una cita: define todo lo que el frontend debe enviar.
export class CreateAppointmentDto {
  // Sucursal/local donde ocurre la cita (UUID obligatorio).
  @IsUUID()
  locationId: string;

  // Cliente que reserva (UUID obligatorio).
  @IsUUID()
  clientId: string;

  // Empleado principal de la cita (UUID obligatorio).
  @IsUUID()
  employeeId: string;

  // Lista de IDs de servicios solicitados. Debe ser un arreglo y, con
  // IsUUID('4', { each: true }), CADA elemento ("each") debe ser un UUID v4.
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];

  // Fecha-hora de inicio en texto ISO 8601 (obligatoria).
  @IsString()
  startTime: string; // ISO 8601 datetime

  // Notas visibles (opcional, texto).
  @IsOptional()
  @IsString()
  notes?: string;

  // Notas internas, solo para el negocio (opcional, texto).
  @IsOptional()
  @IsString()
  internalNotes?: string;

  // Origen de la cita (opcional). Solo se aceptan estos 4 valores (IsEnum):
  // ONLINE (web), WALK_IN (sin cita previa), PHONE (teléfono), MANUAL (a mano).
  @IsOptional()
  @IsEnum(['ONLINE', 'WALK_IN', 'PHONE', 'MANUAL'])
  source?: 'ONLINE' | 'WALK_IN' | 'PHONE' | 'MANUAL';

  // ID del paquete/bundle si la cita proviene de un paquete (opcional, UUID).
  @IsOptional()
  @IsUUID()
  bundleId?: string;

  // Asignaciones servicio→empleado para citas multi-empleado (opcional).
  // Es una lista (@IsArray); ValidateNested({ each: true }) valida cada elemento;
  // @Type(() => ServiceAssignment) indica que cada elemento es un ServiceAssignment.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceAssignment)
  serviceAssignments?: ServiceAssignment[];
}

// DTO para ACTUALIZAR una cita ya creada. Solo permite editar las dos notas;
// el resto (horario, servicios, etc.) se cambia con endpoints específicos.
export class UpdateAppointmentDto {
  // Nueva nota visible (opcional).
  @IsOptional()
  @IsString()
  notes?: string;

  // Nueva nota interna (opcional).
  @IsOptional()
  @IsString()
  internalNotes?: string;
}
