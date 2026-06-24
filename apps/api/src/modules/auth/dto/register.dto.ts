// IMPORTS: decoradores de validación de class-validator (etiquetas "@").
//   - IsEmail: correo válido.   - IsString: texto.   - MinLength: longitud mínima.
//   - IsOptional: campo opcional (puede faltar).
//   - IsIn: el valor debe estar dentro de una lista permitida.
//   - IsBoolean: el valor debe ser true/false.
//   - IsArray: el valor debe ser un arreglo (lista).
//   - Matches: el valor (texto) debe cumplir una expresión regular (regex), es
//     decir, un patrón. Lo usamos para exigir que la contraseña tenga número/símbolo.
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsIn,
  IsBoolean,
  IsArray,
  Matches,
} from 'class-validator';

// DTO del cuerpo de POST /api/auth/register. Es el formulario de registro y
// sirve para los tres tipos de alta: afiliado (con inviteCode), particular
// (individual) y profesional independiente (freelancer). Por eso casi todos los
// campos del negocio son opcionales: dependen del tipo de registro.
export class RegisterDto {
  // Nombre: texto con al menos 1 carácter (no vacío).
  @IsString()
  @MinLength(1)
  firstName: string;

  // Apellido: texto con al menos 1 carácter.
  @IsString()
  @MinLength(1)
  lastName: string;

  // Correo válido (único globalmente en la base de datos).
  @IsEmail()
  email: string;

  // Contraseña con TRES reglas encadenadas:
  //   1) al menos 6 caracteres (MinLength).
  //   2) @Matches(/[0-9]/): la regex /[0-9]/ exige al menos un dígito (0-9).
  //   3) @Matches(/[!@#...]/): exige al menos un símbolo de esa lista de signos.
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @Matches(/[0-9]/, { message: 'La contraseña debe contener al menos un número' })
  @Matches(/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/~`]/, {
    message: 'La contraseña debe contener al menos un símbolo',
  })
  password: string;

  // Teléfono: opcional, texto.
  @IsOptional()
  @IsString()
  phone?: string;

  // Código de invitación: opcional. Si viene, el registro es de un empleado que
  // se une a un negocio existente (flujo "afiliado").
  @IsOptional()
  @IsString()
  inviteCode?: string;

  // Tipo de registro: opcional, pero si viene debe ser uno de estos tres valores.
  @IsOptional()
  @IsIn(['business', 'individual', 'freelancer'])
  type?: 'business' | 'individual' | 'freelancer';

  // Campos de información del negocio (solo para individual/freelancer)
  @IsOptional()
  @IsString()
  businessName?: string;

  // Tipos de negocio en multi-selección (nuevo). Es un arreglo, y "{ each: true }"
  // significa que IsIn se aplica a CADA elemento del arreglo (no al arreglo entero).
  @IsOptional()
  @IsArray()
  @IsIn(['SALON', 'BARBERIA', 'SPA', 'CLINICA', 'TATUAJES'], { each: true })
  businessTypes?: string[];

  // Tipo único antiguo (compatibilidad hacia atrás con formularios viejos).
  @IsOptional()
  @IsIn(['SALON', 'BARBERIA', 'SPA', 'CLINICA', 'TATUAJES'])
  businessType?: string;

  // Campos de dirección desglosada (calle, ciudad, estado, CP, país).
  @IsOptional()
  @IsString()
  businessStreet?: string;

  @IsOptional()
  @IsString()
  businessCity?: string;

  @IsOptional()
  @IsString()
  businessState?: string;

  @IsOptional()
  @IsString()
  businessPostalCode?: string;

  @IsOptional()
  @IsString()
  businessCountry?: string;

  // Dirección única antigua (compatibilidad hacia atrás).
  @IsOptional()
  @IsString()
  businessAddress?: string;

  @IsOptional()
  @IsString()
  businessPhone?: string;

  // Direccion personal del usuario (User.address). Usada en register
  // afiliado para guardar la direccion personal del empleado, separada
  // de la del negocio Tenant.address.
  @IsOptional()
  @IsString()
  personalAddress?: string;

  // Plan elegido: ya no es obligatorio al registrarse (entra en periodo de prueba).
  @IsOptional()
  @IsIn(['BASICO', 'PLUS', 'PRO'])
  selectedPlan?: string;

  // ¿Aceptó el contrato de servicio? Opcional, debe ser true/false.
  @IsOptional()
  @IsBoolean()
  acceptContract?: boolean;

  // ¿Aceptó el aviso de privacidad? Opcional, true/false.
  @IsOptional()
  @IsBoolean()
  acceptPrivacy?: boolean;
}
