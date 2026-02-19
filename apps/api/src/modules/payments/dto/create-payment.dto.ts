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
import { Type } from 'class-transformer';

export class PaymentItemDto {
  @IsString()
  description: string;

  @IsInt()
  @Min(1)
  quantity: number = 1;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsEnum(['SERVICE', 'PRODUCT', 'OTHER'])
  itemType: 'SERVICE' | 'PRODUCT' | 'OTHER';

  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @IsOptional()
  @IsString()
  referenceType?: string;
}

export class CreatePaymentDto {
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsUUID()
  clientId: string;

  @IsUUID()
  locationId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentItemDto)
  items: PaymentItemDto[];

  @IsEnum(['CASH', 'CARD', 'TRANSFER', 'OTHER'])
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

  @IsOptional()
  @IsNumber()
  @Min(0)
  tipAmount?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number = 0;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}
