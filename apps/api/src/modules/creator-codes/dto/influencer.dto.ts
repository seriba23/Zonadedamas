import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

const PHONE_RULE = /^\d{10}$/;
const PHONE_MSG = 'El teléfono debe tener exactamente 10 dígitos, sin espacios';

export class CreateInfluencerDto {
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @MinLength(2, { message: 'El nombre es muy corto' })
  @MaxLength(60)
  firstName: string;

  @IsString()
  @MinLength(2, { message: 'El apellido es muy corto' })
  @MaxLength(60)
  lastName: string;

  @IsOptional()
  @IsString()
  @Matches(PHONE_RULE, { message: PHONE_MSG })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateInfluencerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  lastName?: string;

  @IsOptional()
  @IsString()
  @Matches(PHONE_RULE, { message: PHONE_MSG })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
