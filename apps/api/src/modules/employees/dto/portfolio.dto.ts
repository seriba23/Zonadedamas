import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePortfolioImageDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  caption?: string;
}
