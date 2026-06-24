// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// "class-validator" es una librería que valida datos AUTOMÁTICAMENTE usando
// decoradores (etiquetas "@") sobre las propiedades de una clase. Cuando llega
// una petición, NestJS revisa que el cuerpo (JSON) cumpla estas reglas; si no,
// responde error 400 (petición inválida) sin que escribamos código extra.
//   - IsNotEmpty: la propiedad NO puede venir vacía ("" no se permite).
//   - IsOptional: la propiedad puede faltar (es opcional); si falta, no se
//     valida lo demás sobre ella.
//   - IsString:   la propiedad debe ser texto (string).
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Un "DTO" (Data Transfer Object) es una clase que describe la FORMA de los
// datos que esperamos recibir en una petición. Este DTO define el cuerpo del
// POST para crear una sesión de pago (checkout) de una cita.
export class CreateCheckoutDto {
  // appointmentId = el id de la cita que se va a cobrar.
  @IsString()     // debe ser texto
  @IsNotEmpty()   // y no puede venir vacío (es obligatorio)
  appointmentId: string;

  // returnUrl = a dónde regresar al cliente tras pagar/cancelar. El "?" en
  // "returnUrl?" indica que es OPCIONAL: puede no enviarse.
  @IsOptional()   // puede faltar
  @IsString()     // pero si viene, debe ser texto
  returnUrl?: string;
}
