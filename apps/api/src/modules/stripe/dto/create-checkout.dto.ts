import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCheckoutDto {
  @IsString()
  @IsNotEmpty()
  appointmentId: string;
}
