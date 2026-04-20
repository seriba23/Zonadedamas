import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class BundleAvailabilityQueryDto {
  @IsUUID('4')
  bundleId: string;

  @IsOptional()
  @IsUUID('4')
  locationId?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
