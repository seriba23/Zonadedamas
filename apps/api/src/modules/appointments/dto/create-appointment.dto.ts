import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ServiceAssignment {
  @IsUUID()
  serviceId: string;

  @IsUUID()
  employeeId: string;
}

export class CreateAppointmentDto {
  @IsUUID()
  locationId: string;

  @IsUUID()
  clientId: string;

  @IsUUID()
  employeeId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];

  @IsString()
  startTime: string; // ISO 8601 datetime

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;

  @IsOptional()
  @IsEnum(['ONLINE', 'WALK_IN', 'PHONE', 'MANUAL'])
  source?: 'ONLINE' | 'WALK_IN' | 'PHONE' | 'MANUAL';

  @IsOptional()
  @IsUUID()
  bundleId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceAssignment)
  serviceAssignments?: ServiceAssignment[];
}

export class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}
