// IMPORTS de class-validator:
//   - IsOptional: la propiedad puede venir o no.
//   - IsString: exige texto.
//   - MaxLength: exige una longitud máxima de caracteres.
import { IsOptional, IsString, MaxLength } from 'class-validator';

// DTO para actualizar la información personal/médica del empleado. Todos los
// campos son opcionales: solo se envían los que se quieren cambiar.
export class UpdatePersonalInfoDto {
  // bloodType (tipo de sangre): opcional, texto, máximo 5 caracteres (ej. "O+").
  @IsOptional()
  @IsString()
  @MaxLength(5)
  bloodType?: string;

  // Nombre del contacto de emergencia: opcional, texto.
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  // Apellido del contacto de emergencia: opcional, texto.
  @IsOptional()
  @IsString()
  emergencyContactLastName?: string;

  // Teléfono del contacto de emergencia: opcional, texto.
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  // Relación con el contacto de emergencia (madre, esposo, etc.): opcional,
  // texto, máximo 50 caracteres.
  @IsOptional()
  @IsString()
  @MaxLength(50)
  emergencyContactRelation?: string;

  // Alergias del empleado: opcional, texto.
  @IsOptional()
  @IsString()
  allergies?: string;
}
