import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

class PushKeys {
  @IsString()
  @IsNotEmpty()
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  auth!: string;
}

export class SubscribePushDto {
  @IsString()
  @IsNotEmpty()
  endpoint!: string;

  @IsObject()
  @IsNotEmpty()
  keys!: PushKeys;

  @IsOptional()
  @IsString()
  userAgent?: string;
}
