import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePersonalInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(5)
  bloodType?: string;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  emergencyContactLastName?: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  emergencyContactRelation?: string;

  @IsOptional()
  @IsString()
  allergies?: string;
}
