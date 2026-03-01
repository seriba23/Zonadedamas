import { IsString } from 'class-validator';

export class ClientLoginDto {
  @IsString()
  identifier: string; // email or phone

  @IsString()
  password: string;
}
