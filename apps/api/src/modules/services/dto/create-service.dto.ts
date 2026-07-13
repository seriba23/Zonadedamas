// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: "validadores" de la librería class-validator.
// Cada uno es un decorador (etiqueta "@") que se pone sobre una propiedad para
// comprobar automáticamente que el valor recibido cumple una regla. Si no la
// cumple, NestJS rechaza la petición con error 400 (datos inválidos).
//   - IsBoolean: el valor debe ser true/false.
//   - IsInt: debe ser un número entero (sin decimales).
//   - IsNumber: debe ser un número (admite decimales).
//   - IsOptional: el campo PUEDE faltar; si falta, no se valida lo demás.
//   - IsString: debe ser texto.
//   - IsUUID: debe ser un identificador UUID válido.
//   - Max / Min: valor máximo / mínimo permitido para números.
//   - MinLength: longitud mínima del texto (cantidad de caracteres).
// ─────────────────────────────────────────────────────────────────────────────
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

/**
 * DTO (Data Transfer Object) para CREAR un servicio. Describe y valida la
 * "forma" del JSON que el cliente envía en POST /api/services. Los campos sin
 * "@IsOptional()" y sin "?" son OBLIGATORIOS.
 */
export class CreateServiceDto {
  // name: nombre del servicio. Obligatorio, texto, con al menos 1 carácter
  // (MinLength(1) impide enviar texto vacío "").
  @IsString()
  @MinLength(1)
  name: string;

  // description: descripción del servicio. Opcional ("?"), texto si viene.
  @IsOptional()
  @IsString()
  description?: string;

  // durationMinutes: duración en minutos. Obligatorio, entero, mínimo 1
  // (no puede durar 0 ni negativo).
  @IsInt()
  @Min(1)
  durationMinutes: number;

  // price: precio. Obligatorio, número (admite decimales), mínimo 0
  // (no puede ser negativo; 0 = gratis).
  @IsNumber()
  @Min(0)
  price: number;

  // category: categoría del servicio (ej. "Corte"). Opcional, texto.
  @IsOptional()
  @IsString()
  category?: string;

  // subcategory: subcategoría más específica. Opcional, texto.
  @IsOptional()
  @IsString()
  subcategory?: string;

  // color: color para pintar el servicio en el calendario/UI. Opcional, texto.
  @IsOptional()
  @IsString()
  color?: string;

  // currency: moneda del precio (ej. "USD", "MXN"). Opcional, texto.
  @IsOptional()
  @IsString()
  currency?: string;

  // isActive: si el servicio está activo/visible. Opcional, true/false.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // pointsReward: puntos que el cliente GANA al comprar este servicio. Opcional,
  // entero, mínimo 0 (programa de recompensas).
  @IsOptional()
  @IsInt()
  @Min(0)
  pointsReward?: number;

  // redeemableWithPoints: indica si el servicio se puede pagar/canjear con
  // puntos. Opcional, true/false.
  @IsOptional()
  @IsBoolean()
  redeemableWithPoints?: boolean;

  // pointsRequired: puntos necesarios para canjear el servicio. Opcional,
  // entero, mínimo 0.
  @IsOptional()
  @IsInt()
  @Min(0)
  pointsRequired?: number;

  // depositRequired: indica si se exige un depósito (anticipo) al reservar.
  // Opcional, true/false.
  @IsOptional()
  @IsBoolean()
  depositRequired?: boolean;

  // depositPercent: porcentaje del precio que se cobra como depósito. Opcional,
  // entero entre 1 y 100 (Min(1) y Max(100)).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  depositPercent?: number;

  // homeServiceEnabled: ¿el servicio se puede realizar a domicilio? Opcional.
  @IsOptional()
  @IsBoolean()
  homeServiceEnabled?: boolean;

  // locationId: id de la sucursal a la que pertenece el servicio. Opcional, y si
  // viene debe ser un UUID versión 4 (IsUUID('4')).
  @IsOptional()
  @IsUUID('4')
  locationId?: string;
}

/**
 * DTO para ACTUALIZAR un servicio (PUT /api/services/:id). A diferencia del de
 * crear, AQUÍ TODOS los campos son opcionales (cada uno lleva @IsOptional() y
 * "?"): el cliente envía solo los que quiere cambiar; los demás se dejan igual.
 */
export class UpdateServiceDto {
  // name: nuevo nombre (si viene, texto con al menos 1 carácter).
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  // description: nueva descripción.
  @IsOptional()
  @IsString()
  description?: string;

  // durationMinutes: nueva duración (entero, mínimo 1).
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  // price: nuevo precio (número, mínimo 0).
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  // category: nueva categoría.
  @IsOptional()
  @IsString()
  category?: string;

  // subcategory: nueva subcategoría.
  @IsOptional()
  @IsString()
  subcategory?: string;

  // color: nuevo color.
  @IsOptional()
  @IsString()
  color?: string;

  // currency: nueva moneda.
  @IsOptional()
  @IsString()
  currency?: string;

  // isActive: activar/desactivar el servicio.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // pointsReward: nuevos puntos ganados (entero, mínimo 0).
  @IsOptional()
  @IsInt()
  @Min(0)
  pointsReward?: number;

  // redeemableWithPoints: si se puede canjear con puntos.
  @IsOptional()
  @IsBoolean()
  redeemableWithPoints?: boolean;

  // pointsRequired: nuevos puntos necesarios para canjear (entero, mínimo 0).
  @IsOptional()
  @IsInt()
  @Min(0)
  pointsRequired?: number;

  // depositRequired: si se exige depósito al reservar.
  @IsOptional()
  @IsBoolean()
  depositRequired?: boolean;

  // depositPercent: nuevo porcentaje de depósito (entero entre 1 y 100).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  depositPercent?: number;

  // homeServiceEnabled: ¿el servicio se puede realizar a domicilio?
  @IsOptional()
  @IsBoolean()
  homeServiceEnabled?: boolean;
}
