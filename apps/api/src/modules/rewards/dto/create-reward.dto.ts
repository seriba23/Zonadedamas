// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: decoradores de la librería "class-validator".
// Un DTO ("Data Transfer Object") es una clase que describe la FORMA de los
// datos que llegan en el cuerpo (body) de una petición. Cada decorador "@..."
// es una REGLA de validación: si el dato no cumple la regla, NestJS responde
// automáticamente con error 400 (petición inválida) antes de tocar la lógica.
// ─────────────────────────────────────────────────────────────────────────────
import {
  IsArray,       // exige que el valor sea un arreglo (lista).
  IsBoolean,     // exige true/false.
  IsDateString,  // exige un texto con formato de fecha ISO (ej. "2026-06-23").
  IsIn,          // exige que el valor esté dentro de una lista de opciones fija.
  IsInt,         // exige un número entero (sin decimales).
  IsNumber,      // exige un número (permite decimales).
  IsOptional,    // marca el campo como opcional: si no viene, no se valida.
  IsString,      // exige texto.
  IsUUID,        // exige un identificador único con formato UUID/CUID.
  Min,           // exige un valor mínimo (para números).
  MinLength,     // exige una longitud mínima (para textos).
} from 'class-validator';

// DTO para CREAR una recompensa. Describe y valida cada campo que el dashboard
// envía al backend al dar de alta una recompensa/cupón canjeable por puntos.
export class CreateRewardDto {
  // name: nombre de la recompensa. Debe ser texto y tener al menos 1 carácter
  // (MinLength(1) evita nombres vacíos). Es obligatorio (no lleva @IsOptional).
  @IsString()
  @MinLength(1)
  name: string;

  // description: descripción opcional. El "?" en "description?" significa que
  // puede faltar; @IsOptional confirma que es válido omitirla.
  @IsOptional()
  @IsString()
  description?: string;

  // type: el tipo de recompensa. @IsIn solo acepta uno de estos tres valores:
  //   - 'SERVICIO'    => canjear puntos por un servicio gratis.
  //   - 'DESCUENTO'   => canjear puntos por un descuento (fijo o porcentaje).
  //   - 'TWO_FOR_ONE' => promoción 2x1 sobre ciertos servicios.
  // Es obligatorio. El tipo TypeScript a la derecha limita los valores posibles.
  @IsIn(['SERVICIO', 'DESCUENTO', 'TWO_FOR_ONE'])
  type: 'SERVICIO' | 'DESCUENTO' | 'TWO_FOR_ONE';

  // pointsRequired: cuántos puntos cuesta canjear esta recompensa. Debe ser un
  // entero y como mínimo 0 (Min(0) impide valores negativos). Obligatorio.
  @IsInt()
  @Min(0)
  pointsRequired: number;

  // serviceId: el servicio asociado (cuando la recompensa es de tipo SERVICIO
  // con UN solo servicio). Es opcional y puede ser un UUID o null (string|null).
  @IsOptional()
  @IsUUID()
  serviceId?: string | null;

  // serviceIds: lista de servicios asociados (para varios servicios, descuentos
  // o 2x1). @IsArray exige que sea un arreglo y @IsUUID(undefined, { each: true })
  // valida que CADA elemento del arreglo sea un UUID válido.
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  serviceIds?: string[];

  // discountAmount: el monto del descuento (solo para tipo DESCUENTO). Número
  // mayor o igual a 0. Si discountMode es PERCENTAGE, este número es un %.
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  // discountMode: cómo se interpreta discountAmount:
  //   - 'FLAT'       => descuento de cantidad fija (ej. 50 de moneda).
  //   - 'PERCENTAGE' => descuento porcentual (ej. 20 = 20%).
  @IsOptional()
  @IsIn(['FLAT', 'PERCENTAGE'])
  discountMode?: 'FLAT' | 'PERCENTAGE';

  // Codigo publico opcional (para promos que se validan con codigo manual)
  // code: un código que el cliente o el cajero puede teclear manualmente para
  // aplicar la promo en el POS. Texto opcional.
  @IsOptional()
  @IsString()
  code?: string;

  // Monto minimo de la cita para que el cupon aplique (campo legacy de
  // promotions, util para 2x1 y descuentos).
  // minAmount: importe mínimo de la cita para que la promo sea válida.
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  // Si true, el cupon se puede combinar con "pagar con puntos" en booking.
  // allowPointPayment: permite combinar este cupón con el pago usando puntos
  // dentro del flujo de reserva. Es un booleano opcional.
  @IsOptional()
  @IsBoolean()
  allowPointPayment?: boolean;

  // startDate: fecha desde la que la promo empieza a ser válida (texto ISO).
  @IsOptional()
  @IsDateString()
  startDate?: string;

  // endDate: fecha hasta la que la promo es válida (texto ISO).
  @IsOptional()
  @IsDateString()
  endDate?: string;

  // isActive: si la recompensa está activa (visible/canjeable) o no.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // maxRedemptions: número máximo de veces que se puede canjear en total.
  // Entero, mínimo 1 (no tiene sentido un máximo de 0).
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  // validUntil: fecha de caducidad del cupón generado (texto ISO).
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
