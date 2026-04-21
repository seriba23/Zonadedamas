import {
  Allow,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateResourceDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  imageUrl2?: string;

  @IsOptional()
  @IsString()
  imageUrl3?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @Allow()
  locationQuantities?: Record<string, number>;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @Allow()
  assignedTo?: string | null;

  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @IsUUID('4')
  locationId: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateResourceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  imageUrl2?: string;

  @IsOptional()
  @IsString()
  imageUrl3?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @Allow()
  locationQuantities?: Record<string, number>;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @Allow()
  assignedTo?: string | null;

  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @IsOptional()
  @IsUUID('4')
  locationId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
