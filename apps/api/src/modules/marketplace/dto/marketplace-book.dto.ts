// Decoradores de validación:
//   - IsArray (lista/arreglo), IsBoolean (verdadero/falso),
//   - IsOptional (opcional), IsString (texto),
//   - IsUUID (identificador único con formato UUID),
//   - ValidateNested (valida los objetos DENTRO de una lista, uno por uno).
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
// Type: indica de qué CLASE son los objetos anidados, para poder validarlos.
import { Type } from 'class-transformer';

/**
 * Sub-objeto: asocia UN servicio con UN empleado. Se usa cuando una cita tiene
 * varios servicios hechos por distintos empleados (multi-empleado).
 */
class MarketplaceServiceAssignment {
  @IsUUID('4') // debe ser un UUID versión 4
  serviceId: string; // qué servicio

  @IsUUID('4')
  employeeId: string; // qué empleado lo realiza
}

/**
 * DTO para RESERVAR una cita desde el marketplace: valida todo lo que el cliente
 * envía al confirmar una reserva (servicios, empleado, hora, cupones, etc.).
 */
export class MarketplaceBookDto {
  @IsArray()
  // { each: true } => valida CADA elemento de la lista como UUID v4.
  @IsUUID('4', { each: true })
  serviceIds: string[]; // ids de los servicios a reservar

  @IsUUID('4')
  employeeId: string; // empleado principal de la cita

  @IsString()
  startTime: string; // hora de inicio (texto ISO de fecha-hora)

  @IsOptional()
  @IsString()
  notes?: string; // notas del cliente (opcional)

  @IsOptional()
  @IsString()
  couponCode?: string; // código de cupón a aplicar (opcional)

  @IsOptional()
  @IsUUID('4')
  promotionId?: string; // promoción a aplicar (opcional)

  @IsOptional()
  @IsString()
  referralCode?: string; // código de referido (opcional)

  @IsOptional()
  @IsBoolean()
  payWithPoints?: boolean; // ¿pagar con puntos? (opcional)

  // Multi-empleado: opcional. Si presente, cada item indica qué empleado
  // realiza qué servicio. Se delega tal cual a AppointmentsService.create.
  @IsOptional()
  @IsArray()
  // Valida cada objeto de la lista...
  @ValidateNested({ each: true })
  // ...usando las reglas de la clase MarketplaceServiceAssignment de arriba.
  @Type(() => MarketplaceServiceAssignment)
  serviceAssignments?: MarketplaceServiceAssignment[];
}
