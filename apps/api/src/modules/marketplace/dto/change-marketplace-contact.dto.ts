import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChangeMarketplaceContactDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsNotEmpty()
  @IsString()
  currentPassword: string;
}
