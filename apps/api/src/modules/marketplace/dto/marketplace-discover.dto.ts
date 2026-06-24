// Decoradores de validación de class-validator:
//   - IsBoolean (verdadero/falso), IsEnum (uno de una lista fija),
//   - IsInt (entero), IsNumber (número con decimales), IsOptional (opcional),
//   - IsString (texto), Max/Min (tope superior/inferior).
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
// Transform: de class-transformer, ejecuta una función para CONVERTIR el valor
// recibido antes de validarlo. En la query de la URL todo llega como texto, así
// que aquí transformamos esos textos a número/booleano.
import { Transform } from 'class-transformer';

/**
 * DTO de "descubrir" negocios: valida los filtros que el usuario manda en la
 * query string al buscar negocios en el mapa/listado (ubicación, categoría,
 * texto de búsqueda, ordenación, paginación, etc.).
 */
export class MarketplaceDiscoverDto {
  @IsOptional()
  // parseFloat convierte el texto "19.43" en el número 19.43 (admite decimales).
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  lat?: number; // latitud GPS del usuario

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  lng?: number; // longitud GPS del usuario

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(1)   // radio mínimo 1 km
  @Max(100) // radio máximo 100 km
  radiusKm?: number; // radio de búsqueda en kilómetros

  @IsOptional()
  @IsString()
  // IsEnum limita la categoría a uno de estos cuatro valores exactos.
  @IsEnum(['SALON', 'BARBERIA', 'SPA', 'CLINICA'])
  category?: string;

  @IsOptional()
  @IsString()
  search?: string; // texto libre de búsqueda (nombre del negocio, etc.)

  /** Sort results: distance (default with GPS), rating, services */
  @IsOptional()
  @IsString()
  // Ordenar por: distancia, calificación o cantidad de servicios.
  @IsEnum(['distance', 'rating', 'services'])
  sortBy?: string;

  /** Filter businesses open today */
  @IsOptional()
  // En la query un booleano llega como texto "true". Aquí lo convertimos a true
  // real: es true si el valor es el texto 'true' O ya es el booleano true.
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  availableToday?: boolean; // solo negocios abiertos HOY

  /** Filter businesses with immediate availability (open now + employee available) */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  availableNow?: boolean; // solo negocios disponibles AHORA mismo

  /** Filter only businesses with active shop and at least one product listed */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  shopOnly?: boolean; // solo negocios con tienda activa y al menos un producto

  @IsOptional()
  // parseInt convierte "2" en el entero 2 (sin decimales).
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number; // número de página (paginación)

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number; // cuántos resultados por página (máx. 100)
}
