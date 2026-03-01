import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class MarketplaceRegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/[0-9]/, { message: 'La contraseña debe contener al menos un número' })
  @Matches(/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/~`]/, {
    message: 'La contraseña debe contener al menos un símbolo',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
