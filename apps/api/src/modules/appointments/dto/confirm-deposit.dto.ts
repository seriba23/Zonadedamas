import { IsIn, IsNumber, Min } from 'class-validator';

// DTO para confirmar el anticipo de una cita.
//   - amount: monto recibido (≥ 0). Para 'waive' se ignora.
//   - action: 'accept' confirma la cita; 'request_remainder' registra parcial y
//     deja PENDING; 'waive' exonera el anticipo y confirma.
export class ConfirmDepositDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsIn(['accept', 'request_remainder', 'waive'])
  action: 'accept' | 'request_remainder' | 'waive';
}
