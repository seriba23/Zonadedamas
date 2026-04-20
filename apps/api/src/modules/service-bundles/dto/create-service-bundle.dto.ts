import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateServiceBundleDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  bundlePrice: number;

  @IsArray()
  @IsString({ each: true })
  serviceIds: string[];

  @IsOptional()
  @IsBoolean()
  flexibleOrder?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsReward?: number | null;

  @IsOptional()
  @IsBoolean()
  redeemableWithPoints?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointsRequired?: number | null;
}
