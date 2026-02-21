import {
  IsArray,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PublicAvailabilityQueryDto {
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @IsOptional()
  @IsUUID('4')
  locationId?: string;
}

export class PublicClientDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class PublicBookDto {
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];

  @IsUUID('4')
  employeeId: string;

  @IsString()
  startTime: string;

  @ValidateNested()
  @Type(() => PublicClientDto)
  client: PublicClientDto;

  @IsOptional()
  @IsString()
  notes?: string;
}
