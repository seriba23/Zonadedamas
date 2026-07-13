// DTOs para las ÁREAS DE COBERTURA (servicio a domicilio) de una sucursal.
// El editor de anillos maneja el conjunto completo, así que el guardado es un
// "reemplazo": el cliente envía TODAS las áreas de la sucursal de una vez.
import {
  IsArray,
  IsHexColor,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Una sola área de cobertura (un anillo).
export class CoverageAreaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  // Radio máximo del anillo, en km. > 0 y con tope razonable (200 km).
  @IsNumber()
  @Min(0.1)
  @Max(200)
  radiusKm: number;

  // Cargo a domicilio para esta área (se suma al total). >= 0.
  @IsNumber()
  @Min(0)
  price: number;

  // Color del círculo en el mapa (hex). Opcional; por defecto teal.
  @IsOptional()
  @IsHexColor()
  color?: string;

  // Orden para pintar/ordenar (opcional).
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

// Cuerpo del "reemplazo": la lista completa de áreas de la sucursal.
export class ReplaceCoverageAreasDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoverageAreaDto)
  areas: CoverageAreaDto[];
}
