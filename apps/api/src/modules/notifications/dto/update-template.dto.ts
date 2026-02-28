import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  bodyTemplate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
