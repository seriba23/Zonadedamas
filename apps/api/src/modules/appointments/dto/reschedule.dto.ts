import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RescheduleDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsString()
  startTime: string; // ISO 8601 datetime
}

export class CancelDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
