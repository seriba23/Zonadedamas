import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateMarketplaceProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_SAY'])
  gender?: string;

  @IsOptional()
  @IsString()
  allergies?: string;
}

export class UpdateMarketplaceSettingsDto {
  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['es', 'en', 'pt'])
  language?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['LOCAL', 'USD'])
  currency?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(50)
  searchRadius?: number;

  @IsOptional()
  @IsBoolean()
  notifAppointments?: boolean;

  @IsOptional()
  @IsBoolean()
  notifPromotions?: boolean;

  @IsOptional()
  @IsBoolean()
  notifRewards?: boolean;

  @IsOptional()
  @IsBoolean()
  notifMessages?: boolean;
}
