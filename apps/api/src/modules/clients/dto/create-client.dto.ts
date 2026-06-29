// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De "class-validator" importamos "decoradores de validación". Son etiquetas
// "@" que se ponen encima de las propiedades de una clase para comprobar
// automáticamente que el dato que llega del cliente tiene el formato correcto.
// Si algún dato NO cumple, NestJS responde error 400 antes de tocar la lógica.
//   - IsEmail: el valor debe tener forma de correo (algo@algo.com).
//   - IsOptional: la propiedad puede venir o no (es opcional).
//   - IsString: el valor debe ser texto.
//   - IsDateString: el valor debe ser una fecha en texto (ej. "2026-06-23").
//   - IsBoolean: el valor debe ser verdadero/falso (true/false).
import {
  IsEmail,
  IsOptional,
  IsString,
  IsDateString,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';

/**
 * DTO ("Data Transfer Object" = objeto para transportar datos) que describe la
 * forma del cuerpo (JSON) que el cliente envía al CREAR un nuevo cliente.
 * Cada propiedad lleva sus reglas de validación encima.
 */
export class CreateClientDto {
  // firstName (nombre): obligatorio y debe ser texto. Al no llevar @IsOptional,
  // si falta o no es string, la petición se rechaza.
  @IsString()
  firstName: string;

  // lastName (apellido): obligatorio y de tipo texto.
  @IsString()
  lastName: string;

  // email (correo): opcional (@IsOptional). Si viene, debe ser un email válido.
  // El "?" en "email?" marca la propiedad como opcional en TypeScript.
  @IsOptional()
  @IsEmail()
  email?: string;

  // phone (teléfono): opcional. Si viene, debe ser texto.
  @IsOptional()
  @IsString()
  phone?: string;

  // dateOfBirth (fecha de nacimiento): opcional. Si viene, debe ser una fecha
  // en texto (ej. "1990-05-21"). El servicio la convierte luego a objeto Date.
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  // notes (notas internas): opcional, texto libre (alergias, observaciones...).
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO para ACTUALIZAR un cliente existente. Es casi igual al de creación, pero
 * AQUÍ TODOS los campos son opcionales: el cliente solo envía los que quiere
 * cambiar. Además incluye "isActive" para poder activar/desactivar el registro.
 */
export class UpdateClientDto {
  // Todos opcionales: solo se actualizan los campos presentes en el cuerpo.
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // isActive: opcional, verdadero/falso. Controla si el cliente está activo.
  // (El "borrado" del sistema es lógico: pone isActive en false, no borra fila.)
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // creditBalance: saldo a favor del cliente. El negocio lo ajusta a mano
  // cuando lo usa (lo descuenta manualmente al cobrar).
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditBalance?: number;
}
