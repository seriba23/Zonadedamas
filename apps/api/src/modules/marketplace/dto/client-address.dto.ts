import { IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// DTO para GUARDAR una dirección del cliente (servicio a domicilio). Guardamos la
// dirección legible + coordenadas para poder validar contra las áreas del negocio.
export class CreateClientAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string; // "Casa", "Trabajo" (opcional)

  @IsString()
  @MinLength(1)
  address: string; // dirección legible

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}
