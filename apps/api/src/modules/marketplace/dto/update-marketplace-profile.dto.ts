import { IsOptional, IsString } from 'class-validator';

export class UpdateMarketplaceProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
