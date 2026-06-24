// "Type" (de class-transformer) sirve para CONVERTIR el tipo de un dato. Los
// parámetros de la URL siempre llegan como texto (ej. "2"); con @Type(() => Number)
// le decimos que lo transforme a número antes de validarlo.
import { Type } from 'class-transformer';
// Decoradores de validación:
//   - IsInt: debe ser un número entero.
//   - IsOptional: el campo puede faltar.
//   - IsString: debe ser texto.
//   - Max / Min: valor máximo / mínimo permitido.
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// DTO con los filtros que acepta el listado de notificaciones (vienen en la
// query string, ej: ?page=2&perPage=10&section=appointments&unreadOnly=true).
export class ListNotificationsDto {
  // "page" = número de página a mostrar. "?" = opcional; "= 1" = valor por
  // defecto si no se envía. Debe ser entero y al menos 1.
  @IsOptional()
  @Type(() => Number) // convierte el texto "2" al número 2
  @IsInt()
  @Min(1)
  page?: number = 1;

  // "perPage" = cuántos resultados por página. Por defecto 20, máximo 100
  // (para no pedir demasiados de golpe y sobrecargar la base de datos).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 20;

  // "section" = filtra por sección (appointments, shop, payments, etc.).
  // Opcional: si no se envía, se listan todas las secciones.
  @IsOptional()
  @IsString()
  section?: string;

  // "unreadOnly" = si vale 'true', solo trae las NO leídas. Nota: llega como
  // texto ('true' | 'false'), no como booleano real, por eso es string.
  @IsOptional()
  @IsString()
  unreadOnly?: string; // 'true' | 'false'
}
