// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: los mismos decoradores de validación que en create-reward.dto.ts.
// Aquí describimos la FORMA de los datos al ACTUALIZAR (editar) una recompensa.
// La diferencia clave con CreateRewardDto: aquí TODOS los campos son opcionales,
// porque al editar el usuario quizá solo cambia uno o dos campos.
// ─────────────────────────────────────────────────────────────────────────────
import {
  IsArray,       // exige un arreglo (lista).
  IsBoolean,     // exige true/false.
  IsDateString,  // exige un texto con formato de fecha ISO.
  IsIn,          // exige que el valor esté dentro de una lista fija de opciones.
  IsInt,         // exige un número entero.
  IsNumber,      // exige un número (admite decimales).
  IsOptional,    // marca el campo como opcional.
  IsString,      // exige texto.
  IsUUID,        // exige un identificador con formato UUID/CUID.
  Min,           // exige un valor mínimo (números).
  MinLength,     // exige una longitud mínima (textos).
} from 'class-validator';

// DTO para ACTUALIZAR una recompensa. Cada campo lleva @IsOptional porque en una
// edición se puede mandar solo lo que cambió; lo que no venga, se deja igual.
export class UpdateRewardDto {
  // name: nuevo nombre (opcional). Si viene, debe ser texto de al menos 1 carácter.
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  // description: nueva descripción (opcional).
  @IsOptional()
  @IsString()
  description?: string;

  // type: nuevo tipo de recompensa. Solo se aceptan estos tres valores.
  @IsOptional()
  @IsIn(['SERVICIO', 'DESCUENTO', 'TWO_FOR_ONE'])
  type?: 'SERVICIO' | 'DESCUENTO' | 'TWO_FOR_ONE';

  // pointsRequired: nuevo costo en puntos. Entero, mínimo 1 (al editar no se
  // permite poner 0; al crear sí se permite 0, por eso difiere del Create).
  @IsOptional()
  @IsInt()
  @Min(1)
  pointsRequired?: number;

  // serviceId: nuevo servicio asociado (UUID) o null para quitarlo.
  @IsOptional()
  @IsUUID()
  serviceId?: string | null;

  // serviceIds: nueva lista de servicios. Cada elemento debe ser un UUID válido.
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  serviceIds?: string[];

  // discountAmount: nuevo monto/porcentaje de descuento (>= 0).
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  // discountMode: nuevo modo de descuento, fijo (FLAT) o porcentual (PERCENTAGE).
  @IsOptional()
  @IsIn(['FLAT', 'PERCENTAGE'])
  discountMode?: 'FLAT' | 'PERCENTAGE';

  // code: nuevo código público manual del cupón.
  @IsOptional()
  @IsString()
  code?: string;

  // minAmount: nuevo importe mínimo de cita para que aplique la promo.
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  // allowPointPayment: nuevo valor de "se puede combinar con pago por puntos".
  @IsOptional()
  @IsBoolean()
  allowPointPayment?: boolean;

  // startDate: nueva fecha de inicio de vigencia (texto ISO).
  @IsOptional()
  @IsDateString()
  startDate?: string;

  // endDate: nueva fecha de fin de vigencia (texto ISO).
  @IsOptional()
  @IsDateString()
  endDate?: string;

  // isActive: nuevo estado activo/inactivo de la recompensa.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // maxRedemptions: nuevo máximo total de canjes. Entero, mínimo 1.
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  // validUntil: nueva fecha de caducidad del cupón (texto ISO).
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
