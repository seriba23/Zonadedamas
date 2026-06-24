// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// Un "DTO" (Data Transfer Object) es la forma que esperamos que tenga el JSON
// que el cliente envía. Aquí describimos cada campo y le pegamos "decoradores"
// de validación: etiquetas "@" que, antes de ejecutar la lógica, comprueban
// que el dato cumpla las reglas (es texto, es número, no está vacío, etc.).
// Si algo no cumple, NestJS rechaza la petición con un error 400 automáticamente.
// ─────────────────────────────────────────────────────────────────────────────

// De "class-validator" traemos los decoradores de validación:
import {
  IsString,        // exige que el valor sea texto (string).
  IsOptional,      // marca el campo como OPCIONAL (puede faltar/ser undefined).
  IsNumber,        // exige que el valor sea un número.
  IsEnum,          // exige que el valor esté dentro de una lista cerrada de opciones.
  IsEmail,         // exige que el texto tenga forma de correo (algo@algo.com).
  IsArray,         // exige que el valor sea un arreglo (lista).
  Min,             // valor numérico mínimo permitido.
  Max,             // valor numérico máximo permitido.
  MinLength,       // longitud mínima de un texto (nº de caracteres).
  ValidateIf,      // aplica las validaciones SOLO si se cumple una condición.
  ValidateNested,  // valida también los objetos que van DENTRO de un arreglo/objeto.
} from 'class-validator';
// "Type" de class-transformer le dice al validador a qué CLASE convertir cada
// elemento de un arreglo. Sin esto, no sabría que cada item es un CartItemDto
// y no podría validar sus campos internos.
import { Type } from 'class-transformer';

// ── CartItemDto ──────────────────────────────────────────────────────────────
// Representa UN producto dentro del carrito (cuando se aparta varios a la vez).
// Solo lleva qué producto y cuántas unidades.
export class CartItemDto {
  @IsString() // productId debe ser texto (es el id/UUID del producto).
  productId: string;

  @IsNumber()  // quantity debe ser un número...
  @Min(1)      // ...al menos 1 (no tiene sentido apartar 0)...
  @Max(10)     // ...y como máximo 10 (tope por compra para evitar abusos).
  quantity: number;
}

// ── CreateReservationDto ─────────────────────────────────────────────────────
// La forma del JSON para apartar UN solo producto (reserva individual).
export class CreateReservationDto {
  @IsString() // id del producto a apartar.
  productId: string;

  @IsNumber()  // cantidad de unidades...
  @Min(1)      // ...mínimo 1...
  @Max(10)     // ...máximo 10.
  quantity: number;

  @IsString()     // nombre del cliente: texto...
  @MinLength(2)   // ...de al menos 2 caracteres (evita nombres vacíos/de 1 letra).
  customerName: string;

  @IsOptional()  // el correo es opcional (puede no enviarse)...
  @IsEmail()     // ...pero SI se envía, debe tener forma de email válido.
  customerEmail?: string; // el "?" marca el campo como opcional también en TypeScript.

  @IsString()     // teléfono: texto...
  @MinLength(7)   // ...de al menos 7 dígitos (un número de teléfono mínimamente válido).
  customerPhone: string;

  // fulfillmentType = cómo recibe el producto. IsEnum limita el valor a UNA de
  // estas dos opciones exactas: recoger en tienda (PICKUP) o envío (SHIPPING).
  @IsEnum(['PICKUP', 'SHIPPING'])
  fulfillmentType: 'PICKUP' | 'SHIPPING';

  // preferredPaymentMethod = cómo quiere pagar. Solo se aceptan estos 3 valores:
  // efectivo (CASH), transferencia SPEI (SPEI) o tarjeta (CARD).
  @IsEnum(['CASH', 'SPEI', 'CARD'])
  preferredPaymentMethod: 'CASH' | 'SPEI' | 'CARD';

  // La dirección de envío solo es obligatoria CUANDO el tipo es SHIPPING.
  // ValidateIf recibe una función: "o" es el objeto completo que se está
  // validando, y "o.fulfillmentType === 'SHIPPING'" devuelve true/false.
  //   - "===" compara valor Y tipo (igualdad estricta).
  // Si la condición es true, se aplican las validaciones de abajo (IsString +
  // MinLength). Si es false (es PICKUP), estas validaciones se SALTAN.
  @ValidateIf((o) => o.fulfillmentType === 'SHIPPING')
  @IsString()
  @MinLength(10) // una dirección debe tener al menos 10 caracteres para ser útil.
  shippingAddress?: string;

  @IsOptional()  // appointmentId es opcional: enlaza la reserva con una cita...
  @IsString()    // ...y si viene, debe ser texto (el id de la cita).
  appointmentId?: string;

  @IsOptional()  // notas opcionales del cliente (texto libre).
  @IsString()
  notes?: string;

  @IsOptional()  // URL de la captura del comprobante de pago (opcional)...
  @IsString()    // ...y si viene, debe ser texto.
  paymentProofUrl?: string;
}

// ── CreateBatchReservationDto ────────────────────────────────────────────────
// La forma del JSON para apartar VARIOS productos a la vez (un carrito entero).
// Es casi igual al anterior, pero en vez de un solo producto lleva una lista.
export class CreateBatchReservationDto {
  @IsArray()                       // "items" debe ser un arreglo (lista)...
  @ValidateNested({ each: true })  // ...y "each: true" valida CADA elemento de la lista...
  @Type(() => CartItemDto)         // ...tratando cada elemento como un CartItemDto.
  items: CartItemDto[];

  // De aquí hacia abajo, los campos son idénticos a CreateReservationDto:
  // datos del cliente, tipo de entrega, método de pago, etc.
  @IsString()
  @MinLength(2)
  customerName: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsString()
  @MinLength(7)
  customerPhone: string;

  @IsEnum(['PICKUP', 'SHIPPING'])
  fulfillmentType: 'PICKUP' | 'SHIPPING';

  @IsEnum(['CASH', 'SPEI', 'CARD'])
  preferredPaymentMethod: 'CASH' | 'SPEI' | 'CARD';

  // Igual que antes: la dirección solo se exige si el tipo es SHIPPING.
  @ValidateIf((o) => o.fulfillmentType === 'SHIPPING')
  @IsString()
  @MinLength(10)
  shippingAddress?: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  paymentProofUrl?: string;
}
