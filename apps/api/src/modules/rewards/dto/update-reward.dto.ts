import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateRewardDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['SERVICIO', 'DESCUENTO'])
  type?: 'SERVICIO' | 'DESCUENTO';

  @IsOptional()
  @IsInt()
  @Min(1)
  pointsRequired?: number;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsIn(['FLAT', 'PERCENTAGE'])
  discountMode?: 'FLAT' | 'PERCENTAGE';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
