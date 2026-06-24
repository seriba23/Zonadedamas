// IMPORTS de class-validator:
//   - IsOptional: la propiedad puede venir o no.
//   - IsString: exige texto.
//   - MaxLength: exige una longitud máxima de caracteres.
import { IsOptional, IsString, MaxLength } from 'class-validator';

// DTO para crear una imagen de portafolio del empleado. La imagen en sí se sube
// como archivo aparte; aquí solo viaja el texto que la acompaña.
export class CreatePortfolioImageDto {
  // caption (pie de foto/descripción): opcional, texto, máximo 255 caracteres.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  caption?: string;
}
