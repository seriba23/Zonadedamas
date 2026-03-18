import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class MarketplaceSocialLoginDto {
  @IsString()
  @IsIn(['google', 'facebook'])
  provider: 'google' | 'facebook';

  @IsString()
  @IsNotEmpty()
  token: string;
}
