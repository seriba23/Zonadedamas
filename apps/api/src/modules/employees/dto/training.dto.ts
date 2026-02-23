import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTrainingDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  institution?: string;

  @IsOptional()
  @IsString()
  dateCompleted?: string;
}
