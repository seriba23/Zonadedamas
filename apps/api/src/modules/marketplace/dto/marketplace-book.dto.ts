import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

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
}
