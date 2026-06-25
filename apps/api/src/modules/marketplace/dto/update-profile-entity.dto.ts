// Validadores para EDITAR un perfil existente. Todos los campos son opcionales
// (solo se actualiza lo que venga). Se llama "entity" para no chocar con el DTO
// que edita el perfil-cuenta del usuario (UpdateMarketplaceProfileDto).
import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileEntityDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  // Fecha de nacimiento "AAAA-MM-DD". Puede venir vacía/null para borrarla.
  @IsOptional()
  @IsString()
  dateOfBirth?: string | null;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  allergies?: string;

  // URL de avatar ya subido (la subida del archivo se maneja aparte).
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
