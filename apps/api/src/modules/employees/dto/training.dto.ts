// IMPORTS de class-validator:
//   - IsOptional: la propiedad puede venir o no.
//   - IsString: exige texto.
//   - MaxLength: exige una longitud máxima de caracteres.
import { IsOptional, IsString, MaxLength } from 'class-validator';

// DTO para registrar una formación/capacitación del empleado (cursos, títulos).
export class CreateTrainingDto {
  // title (nombre de la formación): obligatorio, texto, máximo 200 caracteres.
  @IsString()
  @MaxLength(200)
  title: string;

  // institution (centro donde se cursó): opcional, texto, máximo 200 caracteres.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  institution?: string;

  // dateCompleted (fecha en que se completó): opcional, texto (fecha en string).
  @IsOptional()
  @IsString()
  dateCompleted?: string;
}
