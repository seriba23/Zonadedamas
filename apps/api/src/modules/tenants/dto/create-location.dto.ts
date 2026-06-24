// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: decoradores de validación para las "locations" (sucursales del
// negocio: cada local físico donde se atiende).
// ─────────────────────────────────────────────────────────────────────────────
//   - IsEmail: el valor debe ser un correo válido.
//   - IsNumber: el valor debe ser un número.
//   - IsOptional: el campo puede venir o no.
//   - IsString: el valor debe ser texto.
//   - MinLength: el texto debe tener al menos N caracteres.
import { IsEmail, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
// "Type": convierte el valor entrante al tipo indicado (aquí, a Number) ANTES
// de validar. Útil porque los datos de URL/formulario llegan como texto.
import { Type } from 'class-transformer';

// DTO para CREAR una sucursal. Solo el nombre es obligatorio; el resto opcional.
export class CreateLocationDto {
  // Nombre de la sucursal: texto con al menos 1 caracter (no vacío).
  @IsString()
  @MinLength(1)
  name: string;

  // Dirección (texto opcional).
  @IsOptional()
  @IsString()
  address?: string;

  // Teléfono (texto opcional).
  @IsOptional()
  @IsString()
  phone?: string;

  // Correo de la sucursal (opcional; si viene, debe ser un email válido).
  @IsOptional()
  @IsEmail()
  email?: string;

  // Zona horaria de la sucursal (texto opcional).
  @IsOptional()
  @IsString()
  timezone?: string;

  // Latitud (coordenada en el mapa). @Type(() => Number) convierte el texto a
  // número antes de comprobar @IsNumber. Opcional.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  // Longitud (coordenada en el mapa). Mismo patrón que la latitud. Opcional.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}

// DTO para ACTUALIZAR una sucursal. Igual que el de crear, pero AQUÍ TODO es
// opcional: el cliente envía solo los campos que quiere cambiar.
export class UpdateLocationDto {
  // Nombre nuevo (opcional; si viene, mínimo 1 caracter).
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  // Dirección nueva (opcional).
  @IsOptional()
  @IsString()
  address?: string;

  // Teléfono nuevo (opcional).
  @IsOptional()
  @IsString()
  phone?: string;

  // Correo nuevo (opcional; si viene, debe ser email válido).
  @IsOptional()
  @IsEmail()
  email?: string;

  // Zona horaria nueva (opcional).
  @IsOptional()
  @IsString()
  timezone?: string;

  // Latitud nueva (opcional; texto convertido a número).
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  // Longitud nueva (opcional; texto convertido a número).
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}
