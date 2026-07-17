import { IsIn } from 'class-validator';

// DTO para el cambio LIBRE de estado entre estados activos de trabajo. Solo se
// aceptan estos tres (los cierres van por sus flujos; las cerradas por reopen).
export class SetStatusDto {
  @IsIn(['PENDING', 'CONFIRMED', 'IN_PROGRESS'])
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS';
}
