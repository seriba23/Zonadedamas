import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePromotionDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['PERCENTAGE', 'FIXED_AMOUNT', 'TWO_FOR_ONE'])
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'TWO_FOR_ONE';

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsString()
  code?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceIds?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @IsBoolean()
  allowPointPayment?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
