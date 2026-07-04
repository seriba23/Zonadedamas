// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: decoradores de validación para la configuración de la "tienda"
// (shop) del negocio: si vende productos, cómo los entrega y cómo cobra.
// ─────────────────────────────────────────────────────────────────────────────
//   - IsBoolean: el valor debe ser true/false.
//   - IsOptional: el campo puede venir o no.
//   - IsString: el valor debe ser texto.
//   - MaxLength: el texto no puede pasar de N caracteres.
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

// DTO para ACTUALIZAR los ajustes de la tienda. TODO es opcional: el cliente
// envía solo lo que quiere cambiar.
export class UpdateShopSettingsDto {
  // ¿La tienda está activa (visible/funcional)? Opcional, true/false.
  @IsOptional()
  @IsBoolean()
  shopEnabled?: boolean;

  // ¿Permite recoger el pedido en el local (pickup)? Opcional.
  @IsOptional()
  @IsBoolean()
  shopPickupEnabled?: boolean;

  // ¿Permite envío a domicilio (shipping)? Opcional.
  @IsOptional()
  @IsBoolean()
  shopShippingEnabled?: boolean;

  // Costo de envío PLANO por pedido (se cobra una vez por compra a domicilio).
  @IsOptional()
  @IsNumber()
  @Min(0)
  shopShippingCost?: number;

  // ¿Acepta pago en efectivo? Opcional.
  @IsOptional()
  @IsBoolean()
  shopPaymentCash?: boolean;

  // ¿Acepta pago por transferencia SPEI (transferencia bancaria de México)?
  @IsOptional()
  @IsBoolean()
  shopPaymentSpei?: boolean;

  // ¿Acepta pago con tarjeta? Opcional.
  @IsOptional()
  @IsBoolean()
  shopPaymentCard?: boolean;

  // Nombre del banco para recibir SPEI (texto opcional).
  @IsOptional()
  @IsString()
  shopSpeiBankName?: string;

  // Nombre del titular de la cuenta SPEI (texto opcional).
  @IsOptional()
  @IsString()
  shopSpeiHolderName?: string;

  // CLABE: el número de cuenta interbancaria de México. Es texto opcional y
  // tiene exactamente 18 dígitos, por eso @MaxLength(18) limita su longitud.
  @IsOptional()
  @IsString()
  @MaxLength(18)
  shopSpeiClabe?: string;
}
