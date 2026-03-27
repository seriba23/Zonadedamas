import { IsDateString, IsIn, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTimeOffDto {
  @IsDateString()
  startDatetime: string;

  @IsDateString()
  endDatetime: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsIn(['PENDING', 'APPROVED'])
  status?: 'PENDING' | 'APPROVED';
}

export class RejectTimeOffDto {
  @IsString()
  rejectionReason: string;
}

export class ServiceConfigDto {
  @IsString()
  serviceId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commission?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  customPrice?: number;
}

export class SetServicesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceConfigDto)
  services: ServiceConfigDto[];
}
