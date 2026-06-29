// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Un DTO ("Data Transfer Object") describe la FORMA del JSON que llega en una
// petición. Los decoradores de "class-validator" validan automáticamente cada
// campo: si algo no cumple, NestJS responde error 400 antes de tocar la lógica.
//   - IsOptional: el campo puede venir o no (si no viene, no se valida).
//   - IsString: exige que el valor sea texto.
//   - IsUUID: exige que el valor sea un identificador único con formato UUID.
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

// DTO para REAGENDAR una cita (cambiarla de horario, y opcionalmente de empleado).
export class RescheduleDto {
  // employeeId es OPCIONAL: si no lo mandan, se mantiene el empleado actual de la
  // cita. Si lo mandan, debe tener formato UUID válido.
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  // startTime es OBLIGATORIO (no lleva @IsOptional): la nueva fecha-hora de inicio
  // en texto. El comentario aclara que se espera formato ISO 8601
  // (ej. "2026-06-23T15:30:00.000Z").
  @IsString()
  startTime: string; // ISO 8601 datetime
}

// DTO para CANCELAR una cita.
export class CancelDto {
  // reason (motivo de la cancelación) es opcional; si viene, debe ser texto.
  @IsOptional()
  @IsString()
  reason?: string;

  // Qué pasa con el anticipo ya pagado al cancelar:
  //   'forfeit' = el cliente lo pierde (el negocio se queda con la garantía).
  //   'credit'  = queda como crédito a favor del cliente.
  // Si no viene, se usa la política del negocio (depositCancelPolicy).
  @IsOptional()
  @IsIn(['forfeit', 'credit'])
  depositDisposition?: 'forfeit' | 'credit';
}
