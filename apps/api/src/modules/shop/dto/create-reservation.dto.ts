import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsEmail,
  IsArray,
  Min,
  Max,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CartItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  @Max(10)
  quantity: number;
}

export class CreateReservationDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  @Max(10)
  quantity: number;

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
}

export class CreateBatchReservationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

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
}
