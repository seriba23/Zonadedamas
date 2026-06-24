// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De "class-validator" traemos dos decoradores de validación:
//   - IsOptional: marca que la propiedad puede venir o no (es opcional).
//   - IsString: el valor debe ser texto.
import { IsOptional, IsString } from 'class-validator';

// PaginationDto es un DTO base reutilizable que ya trae los campos de paginación
// (típicamente "page" = página y "perPage" = elementos por página) con sus
// validaciones. Lo heredamos para no repetir esa lógica en cada búsqueda.
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * DTO para los filtros de BÚSQUEDA de clientes (los que llegan en la query
 * string de GET /api/clients, ej. ?search=ana&page=2).
 *
 * "extends PaginationDto" significa que HEREDA los campos de paginación
 * (page, perPage) y además añade los campos de filtro de abajo.
 */
export class SearchClientsDto extends PaginationDto {
  // search: texto libre para buscar por nombre/apellido/email/teléfono a la vez.
  // Opcional y de tipo texto.
  @IsOptional()
  @IsString()
  search?: string;

  // email: filtra por coincidencia parcial en el correo. Opcional, texto.
  @IsOptional()
  @IsString()
  email?: string;

  // phone: filtra por coincidencia parcial en el teléfono. Opcional, texto.
  @IsOptional()
  @IsString()
  phone?: string;

  // createdAfter: fecha "desde" (clientes creados a partir de esta fecha).
  // Opcional, texto (ej. "2026-01-01").
  @IsOptional()
  @IsString()
  createdAfter?: string;

  // createdBefore: fecha "hasta" (clientes creados antes/hasta esta fecha).
  // Opcional, texto.
  @IsOptional()
  @IsString()
  createdBefore?: string;
}

/**
 * DTO para CREAR una etiqueta de cliente (ClientTag). Las etiquetas sirven para
 * clasificar clientes (ej. "VIP", "Nuevo", "Moroso") con un color asociado.
 */
export class CreateClientTagDto {
  // name (nombre de la etiqueta): obligatorio y de tipo texto.
  @IsString()
  name: string;

  // color: opcional. Si viene, debe ser texto (ej. un código hex "#008080").
  @IsOptional()
  @IsString()
  color?: string;
}
