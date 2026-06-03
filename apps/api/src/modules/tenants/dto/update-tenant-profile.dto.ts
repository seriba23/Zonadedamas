import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateTenantProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  businessPhone?: string;

  @IsOptional()
  @IsBoolean()
  isMarketplaceListed?: boolean;

  @IsOptional()
  @IsString()
  cardColor?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  confettiEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  confettiStyle?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsHexColor({ each: true })
  confettiColors?: string[] | null;
}
