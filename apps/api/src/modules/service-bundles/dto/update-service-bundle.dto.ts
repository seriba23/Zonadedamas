// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Mismos decoradores de validación de "class-validator" que en el DTO de crear.
// (Ver create-service-bundle.dto.ts para la explicación detallada de cada uno.)
//   - IsArray: debe ser un arreglo.    - IsString: debe ser texto.
//   - IsBoolean: debe ser true/false.  - Min: número >= al valor dado.
//   - IsInt: entero sin decimales.     - MinLength: longitud mínima de texto.
//   - IsNumber: número (con decimales). - IsOptional: la propiedad puede faltar.
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
 * DTO para ACTUALIZAR un paquete de servicios existente.
 *
 * Diferencia clave con el DTO de crear: aquí TODAS las propiedades son
 * opcionales (todas llevan "?" y @IsOptional). Esto permite enviar solo los
 * campos que se quieren cambiar; los que no se envíen, se quedan como estaban.
 */
export class UpdateServiceBundleDto {
  // name = nuevo nombre del paquete (opcional). Si viene, debe ser texto con al
  // menos 1 carácter.
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  // description = nueva descripción (opcional). Si viene, debe ser texto.
  @IsOptional()
  @IsString()
  description?: string;

  // bundlePrice = nuevo precio del paquete (opcional). Número >= 0.
  @IsOptional()
  @IsNumber()
  @Min(0)
  bundlePrice?: number;

  // serviceIds = nueva lista de IDs de servicios del paquete (opcional).
  // Si viene, debe ser un arreglo donde cada elemento (each: true) es texto.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceIds?: string[];

  // flexibleOrder = nuevo valor de "¿orden flexible?" (opcional). true/false.
  @IsOptional()
  @IsBoolean()
  flexibleOrder?: boolean;

  // isActive = nuevo estado activo/inactivo (opcional). true/false.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // sortOrder = nuevo orden de aparición (opcional). Entero >= 0.
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  // pointsReward = nuevos puntos que se ganan al comprar (opcional).
  // Entero >= 0, o null. "number | null" = número o "sin valor".
  @IsOptional()
  @IsInt()
  @Min(0)
  pointsReward?: number | null;

  // redeemableWithPoints = nuevo valor de "¿canjeable con puntos?" (opcional).
  @IsOptional()
  @IsBoolean()
  redeemableWithPoints?: boolean;

  // pointsRequired = nuevos puntos necesarios para canjear (opcional).
  // Entero >= 0, o null.
  @IsOptional()
  @IsInt()
  @Min(0)
  pointsRequired?: number | null;
}
