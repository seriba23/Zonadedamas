import { IsOptional, IsString } from 'class-validator';

export class FilterTemplatesDto {
  @IsOptional()
  @IsString()
  eventTrigger?: string;

  @IsOptional()
  @IsString()
  type?: string;
}
