import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsIn,
  IsBoolean,
  IsArray,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  inviteCode?: string;

  @IsOptional()
  @IsIn(['business', 'individual'])
  type?: 'business' | 'individual';

  // Business info fields
  @IsOptional()
  @IsString()
  businessName?: string;

  // Multi-select business types (new)
  @IsOptional()
  @IsArray()
  @IsIn(['SALON', 'BARBERIA', 'SPA', 'CLINICA', 'TATUAJES'], { each: true })
  businessTypes?: string[];

  // Legacy single type (backward compat)
  @IsOptional()
  @IsIn(['SALON', 'BARBERIA', 'SPA', 'CLINICA', 'TATUAJES'])
  businessType?: string;

  // Expanded address fields
  @IsOptional()
  @IsString()
  businessStreet?: string;

  @IsOptional()
  @IsString()
  businessCity?: string;

  @IsOptional()
  @IsString()
  businessState?: string;

  @IsOptional()
  @IsString()
  businessPostalCode?: string;

  @IsOptional()
  @IsString()
  businessCountry?: string;

  // Legacy single address (backward compat)
  @IsOptional()
  @IsString()
  businessAddress?: string;

  @IsOptional()
  @IsString()
  businessPhone?: string;

  // Plan is no longer required at registration (trial period)
  @IsOptional()
  @IsIn(['BASICO', 'PLUS', 'PRO'])
  selectedPlan?: string;

  @IsOptional()
  @IsBoolean()
  acceptContract?: boolean;
}
