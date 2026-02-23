import { IsString, MaxLength } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @MaxLength(50)
  documentType: string;
}
