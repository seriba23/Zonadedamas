import { IsArray, IsDateString, IsUUID } from 'class-validator';

export class CheckAfterDto {
  @IsUUID('4')
  employeeId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];

  @IsDateString()
  afterTime: string;
}
