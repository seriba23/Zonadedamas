import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  durationMinutes: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsReward?: number;

  @IsOptional()
  @IsBoolean()
  redeemableWithPoints?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsRequired?: number;

  @IsOptional()
  @IsBoolean()
  depositRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  depositPercent?: number;

  @IsOptional()
  @IsUUID('4')
  locationId?: string;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsReward?: number;

  @IsOptional()
  @IsBoolean()
  redeemableWithPoints?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsRequired?: number;

  @IsOptional()
  @IsBoolean()
  depositRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  depositPercent?: number;
}
