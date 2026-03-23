import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCheckoutDto {
  @IsString()
  @IsNotEmpty()
  appointmentId: string;

  @IsOptional()
  @IsString()
  returnUrl?: string;
}
