import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsIn,
  IsBoolean,
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

  // New fields for individual registration wizard
  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsIn(['SALON', 'BARBERIA', 'SPA', 'CLINICA'])
  businessType?: string;

  @IsOptional()
  @IsString()
  businessAddress?: string;

  @IsOptional()
  @IsString()
  businessPhone?: string;

  @IsOptional()
  @IsIn(['BASICO', 'PLUS', 'PRO'])
  selectedPlan?: string;

  @IsOptional()
  @IsBoolean()
  acceptContract?: boolean;
}
