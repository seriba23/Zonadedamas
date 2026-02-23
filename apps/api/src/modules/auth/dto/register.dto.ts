import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsIn,
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
}
