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
// Transform nos deja normalizar el valor ANTES de validar. Lo usamos para
// convertir strings vacíos ('') en undefined, así @IsOptional los ignora (un
// campo vacío en el formulario no debe disparar "email must be an email").
import { Transform } from 'class-transformer';

// Helper: '' (o solo espacios) → undefined; cualquier otro valor se conserva.
const emptyToUndefined = ({ value }: { value: any }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

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
  @Transform(emptyToUndefined)
  @IsEmail()
  email?: string;

  // phone (teléfono): opcional. Si viene, debe ser texto.
  @IsOptional()
  @IsString()
  phone?: string;

  // dateOfBirth (fecha de nacimiento): opcional. Si viene, debe ser una fecha
  // en texto (ej. "1990-05-21"). El servicio la convierte luego a objeto Date.
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  dateOfBirth?: string;

  // notes (notas internas): opcional, texto libre (alergias, observaciones...).
  @IsOptional()
  @IsString()
  notes?: string;

  // allergies (alergias / notas médicas): se muestran en todas las citas.
  @IsOptional()
  @IsString()
  allergies?: string;

  // Contacto de emergencia del cliente.
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
  @Transform(emptyToUndefined)
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // allergies + contacto de emergencia (mismos que en creación).
  @IsOptional()
  @IsString()
  allergies?: string;

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
