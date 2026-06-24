// IMPORTS de class-validator:
//   - IsEnum: exige que el valor sea uno de los valores de un "enum" (lista cerrada).
//   - IsOptional: la propiedad puede venir o no.
//   - IsString: exige texto.
//   - IsUUID: exige un identificador UUID válido.
//   - ValidateIf: aplica las validaciones siguientes SOLO si se cumple una
//     condición (validación condicional).
import { IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

// "enum" = lista cerrada de opciones con nombre. Aquí define las 4 estrategias
// posibles al desactivar un empleado que tiene citas pendientes:
export enum DeactivateAction {
  // Reasignación inteligente: el sistema busca otro empleado libre a la misma hora.
  SMART_RESCHEDULE = 'smart_reschedule',
  // Reasignar manualmente todas las citas a un empleado destino concreto.
  REASSIGN = 'reassign',
  // Cancelar todas las citas pendientes del empleado.
  CANCEL = 'cancel',
  // Mantener las citas tal cual (solo desactiva al empleado).
  KEEP = 'keep',
}

// DTO con los datos que llegan al desactivar un empleado.
export class DeactivateEmployeeDto {
  // action: obligatoria; debe ser uno de los 4 valores del enum de arriba.
  @IsEnum(DeactivateAction)
  action: DeactivateAction;

  // targetEmployeeId: el empleado destino al reasignar. Con @ValidateIf solo se
  // valida (y se exige como UUID) CUANDO action === REASSIGN. La función
  // "(o) => ..." recibe el objeto completo "o" y devuelve true si hay que validar.
  @ValidateIf((o) => o.action === DeactivateAction.REASSIGN)
  @IsUUID()
  targetEmployeeId?: string;

  // cancelReason: motivo de cancelación. Solo se considera CUANDO action === CANCEL;
  // y aun así es opcional (IsOptional) y debe ser texto si viene.
  @ValidateIf((o) => o.action === DeactivateAction.CANCEL)
  @IsOptional()
  @IsString()
  cancelReason?: string;
}
