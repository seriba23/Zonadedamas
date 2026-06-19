import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

const PASSWORD_RULE = /^(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;

export class CreatorLoginDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Ingresa tu contraseña' })
  password: string;
}

export class CreatorRegisterDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  firstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @Matches(PASSWORD_RULE, {
    message: 'La contraseña debe tener mínimo 8 caracteres, un número y un símbolo',
  })
  password: string;
}

export class CreatorSetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @Matches(PASSWORD_RULE, {
    message: 'La contraseña debe tener mínimo 8 caracteres, un número y un símbolo',
  })
  password: string;
}

export class CreatorChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Ingresa tu contraseña actual' })
  currentPassword: string;

  @IsString()
  @Matches(PASSWORD_RULE, {
    message: 'La contraseña debe tener mínimo 8 caracteres, un número y un símbolo',
  })
  newPassword: string;
}
