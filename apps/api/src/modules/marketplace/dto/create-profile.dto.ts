// Validadores de class-validator para crear un perfil (hijo/familiar) del
// usuario de marketplace.
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProfileDto {
  // Nombre del perfil (obligatorio, al menos 1 carácter).
  @IsString()
  @MinLength(1)
  firstName: string;

  // Apellido del perfil (obligatorio).
  @IsString()
  @MinLength(1)
  lastName: string;

  // Relación con el tutor. Solo CHILD u OTHER (el SELF es el propio usuario y no
  // se crea por aquí). Opcional: por defecto el backend asume CHILD.
  @IsOptional()
  @IsIn(['CHILD', 'OTHER'])
  relationship?: string;

  // Fecha de nacimiento en texto "AAAA-MM-DD" (opcional). El backend deriva de
  // ella si el perfil es menor de edad.
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  // Género (opcional).
  @IsOptional()
  @IsString()
  gender?: string;

  // Alergias / notas médicas (opcional).
  @IsOptional()
  @IsString()
  allergies?: string;
}
