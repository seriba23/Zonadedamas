import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ServiceAssignmentDto {
  @IsUUID('4')
  serviceId: string;

  @IsUUID('4')
  employeeId: string;
}

export class CompositeAvailabilityQueryDto {
  @IsOptional()
  @IsUUID('4')
  locationId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ServiceAssignmentDto)
  serviceAssignments: ServiceAssignmentDto[];

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
