// IMPORTS de class-validator:
//   - IsString: exige que el valor sea texto.
//   - MaxLength: exige una longitud máxima de caracteres.
import { IsString, MaxLength } from 'class-validator';

// DTO para crear un documento del empleado (p. ej. contrato, identificación).
export class CreateDocumentDto {
  // documentType: el tipo de documento. Obligatorio, texto, máximo 50 caracteres.
  @IsString()
  @MaxLength(50)
  documentType: string;
}
