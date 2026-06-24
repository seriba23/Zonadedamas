// IMPORTS: decoradores de validación de class-validator (etiquetas "@").
//   - IsIn: exige que el valor esté DENTRO de una lista permitida.
//   - IsNotEmpty: exige que el valor NO esté vacío ("").
//   - IsOptional: marca el campo como opcional (puede faltar).
//   - IsString: exige que el valor sea texto.
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// DTO para el cuerpo de POST /api/auth/social (inicio de sesión con redes
// sociales). El frontend obtiene un token del proveedor (Google/Facebook) y lo
// manda aquí; el backend lo verifica contra el proveedor.
export class SocialLoginDto {
  // "provider" indica con qué red social entra el usuario. Debe ser texto y, por
  // @IsIn, SOLO puede valer 'google' o 'facebook'. El tipo TypeScript
  // ('google' | 'facebook') refuerza lo mismo a nivel de código.
  @IsString()
  @IsIn(['google', 'facebook'])
  provider: 'google' | 'facebook';

  // "token" es el token que devolvió la red social. Debe ser texto y no vacío.
  @IsString()
  @IsNotEmpty()
  token: string;

  // "inviteCode" es opcional. El "?" en "inviteCode?" indica que puede no venir.
  // Se usa cuando un usuario nuevo se registra con red social uniéndose a un
  // negocio mediante un código de invitación.
  @IsOptional()
  @IsString()
  inviteCode?: string;
}
