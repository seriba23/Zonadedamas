import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRewardDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['SERVICIO', 'DESCUENTO', 'TWO_FOR_ONE'])
  type: 'SERVICIO' | 'DESCUENTO' | 'TWO_FOR_ONE';

  @IsInt()
  @Min(0)
  pointsRequired: number;

  @IsOptional()
  @IsUUID()
  serviceId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  serviceIds?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsIn(['FLAT', 'PERCENTAGE'])
  discountMode?: 'FLAT' | 'PERCENTAGE';

  // Codigo publico opcional (para promos que se validan con codigo manual)
  @IsOptional()
  @IsString()
  code?: string;

  // Monto minimo de la cita para que el cupon aplique (campo legacy de
  // promotions, util para 2x1 y descuentos).
  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  // Si true, el cupon se puede combinar con "pagar con puntos" en booking.
  @IsOptional()
  @IsBoolean()
  allowPointPayment?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
