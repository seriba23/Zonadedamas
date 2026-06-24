// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// De "class-validator" importamos "decoradores de validación". Cada uno es una
// etiqueta "@" que se coloca encima de una propiedad y obliga a que el dato que
// llegue desde el cliente cumpla cierta regla. Si no la cumple, NestJS rechaza
// la petición con un error 400 (petición inválida) automáticamente.
//   - IsArray: el valor debe ser un arreglo (una lista).
//   - IsBoolean: el valor debe ser true o false.
//   - IsInt: el valor debe ser un número entero (sin decimales).
//   - IsNumber: el valor debe ser un número (permite decimales).
//   - IsOptional: la propiedad puede faltar (no es obligatoria).
//   - IsString: el valor debe ser texto.
//   - Min: el número no puede ser menor que el valor indicado.
//   - MinLength: el texto debe tener al menos esa cantidad de caracteres.
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

/**
 * DTO = "Data Transfer Object" (objeto de transferencia de datos). Describe la
 * FORMA exacta que debe tener el JSON que el cliente envía para CREAR un paquete
 * de servicios (varios servicios vendidos juntos a un precio rebajado).
 * Cada propiedad lleva encima sus reglas de validación.
 */
export class CreateServiceBundleDto {
  // name = nombre del paquete. Debe ser texto y tener al menos 1 carácter
  // (MinLength(1) evita que llegue un nombre vacío "").
  @IsString()
  @MinLength(1)
  name: string;

  // description = descripción opcional del paquete.
  // El "?" después de "description" indica que la propiedad puede no venir.
  // @IsOptional permite que falte; si viene, @IsString exige que sea texto.
  @IsOptional()
  @IsString()
  description?: string;

  // bundlePrice = precio del paquete completo. Debe ser un número y no puede ser
  // negativo (Min(0) => mínimo 0).
  @IsNumber()
  @Min(0)
  bundlePrice: number;

  // serviceIds = lista de IDs de los servicios que forman el paquete.
  // @IsArray exige que sea una lista; @IsString({ each: true }) exige que CADA
  // elemento de esa lista (each: true = "cada uno") sea un texto (un ID).
  @IsArray()
  @IsString({ each: true })
  serviceIds: string[];

  // flexibleOrder = ¿se pueden hacer los servicios en cualquier orden?
  // Opcional; si viene, debe ser true/false.
  @IsOptional()
  @IsBoolean()
  flexibleOrder?: boolean;

  // isActive = ¿el paquete está activo (visible/comprable)?
  // Opcional; si viene, debe ser true/false.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // sortOrder = orden de aparición en la lista (0 = primero).
  // Opcional; debe ser un entero no negativo.
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  // pointsReward = puntos de fidelidad que GANA el cliente al comprar el paquete.
  // Opcional; debe ser un entero >= 0. El tipo "number | null" significa que su
  // valor puede ser un número O nulo (null = "sin valor definido").
  @IsOptional()
  @IsInt()
  @Min(0)
  pointsReward?: number | null;

  // redeemableWithPoints = ¿el paquete se puede CANJEAR pagando con puntos?
  // Opcional; debe ser true/false.
  @IsOptional()
  @IsBoolean()
  redeemableWithPoints?: boolean;

  // pointsRequired = cuántos puntos hacen falta para canjear el paquete.
  // Opcional; debe ser un entero >= 0, o null si no aplica.
  @IsOptional()
  @IsInt()
  @Min(0)
  pointsRequired?: number | null;
}
