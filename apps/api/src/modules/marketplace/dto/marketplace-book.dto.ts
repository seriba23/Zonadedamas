import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MarketplaceServiceAssignment {
  @IsUUID('4')
  serviceId: string;

  @IsUUID('4')
  employeeId: string;
}

export class MarketplaceBookDto {
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];

  @IsUUID('4')
  employeeId: string;

  @IsString()
  startTime: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsUUID('4')
  promotionId?: string;

  @IsOptional()
  @IsString()
  referralCode?: string;

  @IsOptional()
  @IsBoolean()
  payWithPoints?: boolean;

  // Multi-empleado: opcional. Si presente, cada item indica qué empleado
  // realiza qué servicio. Se delega tal cual a AppointmentsService.create.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketplaceServiceAssignment)
  serviceAssignments?: MarketplaceServiceAssignment[];
}
