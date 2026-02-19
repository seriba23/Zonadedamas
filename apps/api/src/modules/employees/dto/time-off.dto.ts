import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateTimeOffDto {
  @IsDateString()
  startDatetime: string;

  @IsDateString()
  endDatetime: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class SetServicesDto {
  serviceIds: string[];
}
