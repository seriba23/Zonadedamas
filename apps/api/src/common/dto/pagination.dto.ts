// ─────────────────────────────────────────────────────────────────────────────
// DTOs DE PAGINACIÓN — "cómo pedir y devolver listas por páginas"
// ─────────────────────────────────────────────────────────────────────────────
//
// IDEA GENERAL: un DTO (Data Transfer Object) es una clase que describe la FORMA
// de los datos que entran o salen de la API, y de paso permite VALIDARLOS. Aquí
// definimos los parámetros de paginación (página y cuántos por página), de
// ordenación, y un helper para armar la respuesta paginada estándar del
// proyecto: { data, meta }.

// class-transformer: "Type" sirve para CONVERTIR tipos al recibir datos. En la
// URL todo llega como TEXTO (ej. ?page=2 llega como "2"); con @Type(() => Number)
// le pedimos que lo transforme a número real antes de validarlo.
import { Type } from 'class-transformer';
// class-validator: decoradores que VALIDAN cada campo automáticamente.
//   - IsInt: debe ser un número entero.
//   - IsOptional: el campo puede faltar (si falta, se aplica el valor por
//     defecto y NO se valida).
//   - IsString: debe ser texto.
//   - Max / Min: límites máximo y mínimo permitidos.
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// PaginationDto: los parámetros de paginación que el cliente puede enviar.
export class PaginationDto {
  // page: número de página a mostrar.
  @IsOptional()          // puede no enviarse
  @Type(() => Number)    // convertir el texto de la URL a número
  @IsInt()               // debe ser entero
  @Min(1)                // mínimo 1 (no existe la página 0 ni negativas)
  // "page?: number = 1": el "?" indica opcional; "= 1" es el valor por defecto
  // si no llega (empezamos en la página 1).
  page?: number = 1;

  // perPage: cuántos elementos por página.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)                // al menos 1 por página
  @Max(100)              // como máximo 100 (evita pedir listas enormes que
                         // sobrecarguen el servidor)
  // Por defecto, 20 elementos por página.
  perPage?: number = 20;
}

// SortDto: parámetros opcionales para ordenar una lista.
export class SortDto {
  // sortBy: el nombre del campo por el que ordenar (ej. "createdAt").
  @IsOptional()
  @IsString()
  sortBy?: string;

  // sortOrder: dirección del orden. El tipo "'asc' | 'desc'" (unión de tipos)
  // restringe el valor a SOLO esos dos textos: ascendente o descendente.
  @IsOptional()
  @IsString()
  // Por defecto, ascendente.
  sortOrder?: 'asc' | 'desc' = 'asc';
}

// PaginatedResponse<T>: la FORMA de la respuesta paginada. El "<T>" es un tipo
// GENÉRICO (un comodín): permite reutilizar esta interface con cualquier tipo de
// dato (citas, clientes, etc.). Así "data: T[]" será un arreglo de lo que sea
// que estemos paginando.
export interface PaginatedResponse<T> {
  data: T[]; // los elementos de la página actual
  meta: {    // información sobre la paginación
    total: number;      // total de elementos que existen (en todas las páginas)
    page: number;       // página actual
    perPage: number;    // elementos por página
    totalPages: number; // número total de páginas
  };
}

// buildPaginatedResponse: helper que arma el objeto { data, meta } estándar.
// Es genérico (<T>) igual que la interface. Recibe:
//   - data: los elementos de esta página (ya consultados a la DB).
//   - total: cuántos elementos hay en total.
//   - pagination: el DTO con page y perPage que pidió el cliente.
// Devuelve un PaginatedResponse<T> listo para responder.
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  pagination: PaginationDto,
): PaginatedResponse<T> {
  // "pagination.page ?? 1" usa el operador NULLISH COALESCING "??":
  // toma pagination.page SOLO si es null o undefined usa 1. (A diferencia de
  // "||", el "??" NO sustituye valores como 0 o "" — solo null/undefined.)
  const page = pagination.page ?? 1;
  const perPage = pagination.perPage ?? 20;
  return {
    data,
    meta: {
      total,
      page,
      perPage,
      // totalPages = total dividido entre perPage, redondeado HACIA ARRIBA con
      // Math.ceil (porque aunque sobren pocos elementos necesitan otra página).
      // Ej.: 21 elementos / 20 por página = 1.05 -> ceil -> 2 páginas.
      totalPages: Math.ceil(total / perPage),
    },
  };
}
