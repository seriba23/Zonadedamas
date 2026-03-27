import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SocialLoginDto {
  @IsString()
  @IsIn(['google', 'facebook'])
  provider: 'google' | 'facebook';

  @IsString()
  @IsNotEmpty()
  token: string;

  @IsOptional()
  @IsString()
  inviteCode?: string;
}
