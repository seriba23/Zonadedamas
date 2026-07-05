// Decoradores de validación:
//   - IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min (ya explicados),
//   - IsDateString: el texto debe tener formato de fecha ISO (ej. "1990-05-20").
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
// Transform: convierte el valor recibido (aquí, texto -> número entero).
import { Transform } from 'class-transformer';

/**
 * DTO para actualizar el PERFIL del usuario de marketplace. Todos los campos
 * son opcionales: solo se actualizan los que el usuario envíe.
 */
export class UpdateMarketplaceProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string; // nombre

  @IsOptional()
  @IsString()
  lastName?: string; // apellido

  @IsOptional()
  @IsDateString() // fecha en formato ISO
  birthDate?: string; // fecha de nacimiento

  @IsOptional()
  @IsString()
  // El género debe ser uno de estos valores fijos.
  @IsEnum(['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_SAY'])
  gender?: string;

  @IsOptional()
  @IsString()
  allergies?: string; // alergias / notas médicas

  // Contacto de emergencia (opcional) que el cliente mantiene en su cuenta.
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  emergencyContactLastName?: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @IsOptional()
  @IsString()
  emergencyContactRelation?: string;

  @IsOptional()
  @IsString()
  address?: string; // dirección

  @IsOptional()
  @IsString()
  country?: string; // país

  @IsOptional()
  @IsString()
  phone?: string; // teléfono
}

/**
 * DTO para actualizar los AJUSTES del usuario (preferencias de idioma, moneda,
 * radio de búsqueda y notificaciones). También todo opcional.
 */
export class UpdateMarketplaceSettingsDto {
  @IsOptional()
  @IsString()
  country?: string; // país de los ajustes

  @IsOptional()
  @IsString()
  @IsEnum(['es', 'en', 'pt']) // idioma: español, inglés o portugués
  language?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['LOCAL', 'USD']) // moneda: local o dólares
  currency?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value)) // texto -> entero
  @IsInt()
  @Min(1)  // mínimo 1 km
  @Max(50) // máximo 50 km
  searchRadius?: number; // radio de búsqueda preferido por defecto

  @IsOptional()
  @IsBoolean()
  notifAppointments?: boolean; // ¿recibir avisos de citas?

  @IsOptional()
  @IsBoolean()
  notifPromotions?: boolean; // ¿recibir avisos de promociones?

  @IsOptional()
  @IsBoolean()
  notifRewards?: boolean; // ¿recibir avisos de recompensas?

  @IsOptional()
  @IsBoolean()
  notifMessages?: boolean; // ¿recibir avisos de mensajes?
}
