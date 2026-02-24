import { IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export enum DeactivateAction {
  SMART_RESCHEDULE = 'smart_reschedule',
  REASSIGN = 'reassign',
  CANCEL = 'cancel',
  KEEP = 'keep',
}

export class DeactivateEmployeeDto {
  @IsEnum(DeactivateAction)
  action: DeactivateAction;

  @ValidateIf((o) => o.action === DeactivateAction.REASSIGN)
  @IsUUID()
  targetEmployeeId?: string;

  @ValidateIf((o) => o.action === DeactivateAction.CANCEL)
  @IsOptional()
  @IsString()
  cancelReason?: string;
}
