// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: decoradores de validación para el "perfil" del negocio (los datos
// que se ven en el marketplace y ajustes visuales como el confeti).
// ─────────────────────────────────────────────────────────────────────────────
//   - ArrayMaxSize: la lista no puede tener más de N elementos.
//   - ArrayMinSize: la lista debe tener al menos N elementos.
//   - IsArray: el valor debe ser una lista.
//   - IsBoolean: el valor debe ser true/false.
//   - IsHexColor: el valor debe ser un color en formato hexadecimal (ej. "#008080").
//   - IsOptional: el campo puede venir o no.
//   - IsString: el valor debe ser texto.
//   - MaxLength: el texto no puede pasar de N caracteres.
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// DTO para ACTUALIZAR el perfil del negocio. TODO opcional: se envía solo lo
// que se quiere cambiar.
export class UpdateTenantProfileDto {
  // Nombre del negocio (texto opcional).
  @IsOptional()
  @IsString()
  name?: string;

  // Descripción/biografía del negocio (texto opcional).
  @IsOptional()
  @IsString()
  description?: string;

  // Tipo de negocio (ej. "Salon", "Barberia", "SPA"). Texto opcional.
  @IsOptional()
  @IsString()
  businessType?: string;

  // Dirección visible en el perfil (texto opcional).
  @IsOptional()
  @IsString()
  address?: string;

  // Teléfono de contacto del negocio (texto opcional).
  @IsOptional()
  @IsString()
  businessPhone?: string;

  // ¿El negocio aparece listado en el marketplace público? true/false opcional.
  @IsOptional()
  @IsBoolean()
  isMarketplaceListed?: boolean;

  // Color de la tarjeta del negocio en el marketplace (texto opcional).
  @IsOptional()
  @IsString()
  cardColor?: string;

  // Moneda del negocio (texto opcional).
  @IsOptional()
  @IsString()
  currency?: string;

  // ── Anticipo (depósito) para confirmar citas ──
  // ¿El negocio exige anticipo para confirmar las citas? Opcional.
  @IsOptional()
  @IsBoolean()
  depositEnabled?: boolean;

  // Tipo de anticipo: 'FIXED' (monto fijo) o 'PERCENT' (% del total de servicios).
  @IsOptional()
  @IsIn(['FIXED', 'PERCENT'])
  depositType?: 'FIXED' | 'PERCENT';

  // Valor del anticipo: el monto fijo o el porcentaje, según depositType.
  @IsOptional()
  @IsNumber()
  depositValue?: number;

  // Instrucciones de transferencia (texto libre) que verá el cliente.
  @IsOptional()
  @IsString()
  depositInstructions?: string;

  // ¿Está activada la animación de confeti al completar acciones? Opcional.
  @IsOptional()
  @IsBoolean()
  confettiEnabled?: boolean;

  // Estilo de confeti (un nombre de estilo). El tipo "string | null" permite
  // texto O el valor null (para "ningún estilo"). Máximo 40 caracteres. Opcional.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  confettiStyle?: string | null;

  // Lista de estilos de confeti (varios). Debe ser un arreglo de máximo 3
  // elementos, donde @IsString({ each: true }) valida que CADA elemento sea
  // texto. Puede ser null. Opcional.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  confettiStyles?: string[] | null;

  // Lista de colores del confeti. Debe ser un arreglo de entre 1 y 4 elementos,
  // donde @IsHexColor({ each: true }) valida que CADA color sea hexadecimal
  // (ej. "#FF0000"). Puede ser null. Opcional.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsHexColor({ each: true })
  confettiColors?: string[] | null;
}
