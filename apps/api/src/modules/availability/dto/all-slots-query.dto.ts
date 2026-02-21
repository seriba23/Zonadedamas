import {
  IsArray,
  IsDateString,
  IsUUID,
} from 'class-validator';

export class AllSlotsQueryDto {
  @IsDateString()
  date: string;

  @IsUUID('4')
  employeeId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];
}
