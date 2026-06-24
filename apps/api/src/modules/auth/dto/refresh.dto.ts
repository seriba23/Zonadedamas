// IMPORTS
// IsString: decorador (etiqueta "@") de class-validator que exige que el valor
// sea una cadena de texto. Si no lo es, NestJS responde con error 400.
import { IsString } from 'class-validator';

// DTO (objeto de transferencia de datos) para el cuerpo de POST /api/auth/refresh.
// Cuando el "access token" (token de acceso) caduca a los 15 min, el frontend
// envía aquí su "refresh token" (token de actualización) para obtener uno nuevo
// sin pedir de nuevo email/contraseña.
export class RefreshDto {
  // El refresh token recibido debe ser un string (un UUID en texto).
  @IsString()
  refreshToken: string;
}
