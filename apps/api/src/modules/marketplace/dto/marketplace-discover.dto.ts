import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class MarketplaceDiscoverDto {
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  lng?: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  radiusKm?: number;

  @IsOptional()
  @IsString()
  @IsEnum(['SALON', 'BARBERIA', 'SPA', 'CLINICA'])
  category?: string;

  @IsOptional()
  @IsString()
  search?: string;

  /** Sort results: distance (default with GPS), rating, services */
  @IsOptional()
  @IsString()
  @IsEnum(['distance', 'rating', 'services'])
  sortBy?: string;

  /** Filter businesses open today */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  availableToday?: boolean;

  /** Filter businesses with immediate availability (open now + employee available) */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  availableNow?: boolean;

  /** Filter only businesses with active shop and at least one product listed */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  shopOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;
}
