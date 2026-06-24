// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// "class-validator" da decoradores (etiquetas "@") que VALIDAN cada campo del
// objeto que llega en el cuerpo (JSON) de la petición. Si algún campo no cumple
// su regla, NestJS rechaza la petición con error 400 (datos inválidos) ANTES de
// que la lógica del servicio se ejecute. Importamos las reglas que usaremos:
//   - IsArray: el campo debe ser un arreglo (una lista).
//   - IsEnum: el valor debe ser uno de una lista cerrada de opciones permitidas.
//   - IsNumber: debe ser un número (admite decimales).
//   - IsOptional: el campo PUEDE faltar; si falta, no se valida lo demás.
//   - IsString: debe ser texto.
//   - IsUUID: debe ser un identificador con formato UUID/CUID (ej. el id de la BD).
//   - Min: el número no puede ser menor que el mínimo indicado.
//   - ValidateNested: valida también los objetos DENTRO de un arreglo/objeto.
//   - IsInt: debe ser un número entero (sin decimales).
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  IsInt,
} from 'class-validator';
// "Type" de class-transformer le dice al validador de qué CLASE es cada elemento
// de un arreglo, para poder construir y validar esos objetos anidados (aquí, los
// PaymentItemDto dentro de "items").
import { Type } from 'class-transformer';

/**
 * PaymentItemDto = la forma (estructura) de UN renglón del pago. Un pago puede
 * tener varios renglones (un servicio, un producto, etc.); cada uno es uno de
 * estos objetos.
 */
export class PaymentItemDto {
  // description = texto que describe el renglón (ej. "Corte de cabello"). Debe
  // ser una cadena de texto.
  @IsString()
  description: string;

  // quantity = cuántas unidades de este renglón. Debe ser un entero (IsInt) y
  // como mínimo 1 (Min(1)). El "= 1" es el valor por defecto si no llega nada.
  @IsInt()
  @Min(1)
  quantity: number = 1;

  // unitPrice = precio por unidad. Debe ser un número y no negativo (Min(0)).
  @IsNumber()
  @Min(0)
  unitPrice: number;

  // itemType = qué clase de renglón es. IsEnum obliga a que el valor sea
  // EXACTAMENTE uno de estos tres textos: 'SERVICE', 'PRODUCT' u 'OTHER'.
  // La parte después de los dos puntos es el "tipo" en TypeScript: la unión
  // de esos tres literales (solo uno de ellos es válido).
  @IsEnum(['SERVICE', 'PRODUCT', 'OTHER'])
  itemType: 'SERVICE' | 'PRODUCT' | 'OTHER';

  // referenceId = id opcional de la entidad real a la que apunta el renglón
  // (ej. el id del servicio o producto). El "?" lo marca como opcional, e
  // IsOptional permite que falte. Si viene, debe tener formato UUID.
  @IsOptional()
  @IsUUID()
  referenceId?: string;

  // referenceType = texto opcional que indica a QUÉ tabla apunta referenceId
  // (ej. "service" o "product"). Opcional y, si viene, debe ser texto.
  @IsOptional()
  @IsString()
  referenceType?: string;
}

/**
 * CreatePaymentDto = la forma (estructura) del cuerpo (JSON) que se envía para
 * CREAR un pago. Reúne a quién se cobra, qué se cobra (items) y los montos
 * extra (propina, descuento, impuesto).
 */
export class CreatePaymentDto {
  // appointmentId = id opcional de la cita a la que se asocia el cobro. Si el
  // pago es de una cita, aquí va su id. Opcional y, si viene, formato UUID.
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  // Cobro de un apartado standalone (sin cita o con cita cancelada).
  // Mutuamente excluyente con appointmentId.
  // productReservationId = id opcional del "apartado" de productos. Se usa
  // cuando el cobro NO es de una cita sino de productos reservados aparte.
  @IsOptional()
  @IsUUID()
  productReservationId?: string;

  // clientId = id del cliente al que se le cobra. Obligatorio (no lleva "?") y
  // debe tener formato UUID.
  @IsUUID()
  clientId: string;

  // locationId = id de la sucursal donde se realiza el cobro. Obligatorio, UUID.
  @IsUUID()
  locationId: string;

  // items = la lista de renglones del pago. Debe ser un arreglo (IsArray).
  // ValidateNested({ each: true }) valida CADA elemento del arreglo por
  // separado, y @Type(() => PaymentItemDto) indica que cada elemento es un
  // PaymentItemDto (la clase de arriba). La "[]" en el tipo significa "arreglo de".
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentItemDto)
  items: PaymentItemDto[];

  // paymentMethod = cómo se pagó. IsEnum obliga a uno de los cuatro métodos:
  // efectivo (CASH), tarjeta (CARD), transferencia (TRANSFER) u otro (OTHER).
  @IsEnum(['CASH', 'CARD', 'TRANSFER', 'OTHER'])
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

  // tipAmount = propina. Opcional, número, no negativo. Por defecto 0 si no llega.
  @IsOptional()
  @IsNumber()
  @Min(0)
  tipAmount?: number = 0;

  // discountAmount = descuento aplicado. Opcional, número, no negativo. Por
  // defecto 0. Este monto se RESTA del total (ver cálculo en el servicio).
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number = 0;

  // taxAmount = impuesto. Opcional, número, no negativo. Por defecto 0. Este
  // monto se SUMA al total (ver cálculo en el servicio).
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number = 0;

  // notes = comentario libre opcional sobre el pago. Si viene, debe ser texto.
  @IsOptional()
  @IsString()
  notes?: string;

  // reference = referencia opcional (ej. número de autorización de la tarjeta o
  // folio de la transferencia). Si viene, debe ser texto.
  @IsOptional()
  @IsString()
  reference?: string;
}
