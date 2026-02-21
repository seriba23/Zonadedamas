import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBusinessClosureDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class ClosureQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
