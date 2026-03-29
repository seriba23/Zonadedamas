import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ChangeMarketplaceContactDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  otpCode?: string;
}
