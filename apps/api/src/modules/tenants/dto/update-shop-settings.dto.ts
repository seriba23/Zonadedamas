import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateShopSettingsDto {
  @IsOptional()
  @IsBoolean()
  shopEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  shopPickupEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  shopShippingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  shopPaymentCash?: boolean;

  @IsOptional()
  @IsBoolean()
  shopPaymentSpei?: boolean;

  @IsOptional()
  @IsBoolean()
  shopPaymentCard?: boolean;

  @IsOptional()
  @IsString()
  shopSpeiBankName?: string;

  @IsOptional()
  @IsString()
  shopSpeiHolderName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  shopSpeiClabe?: string;
}
