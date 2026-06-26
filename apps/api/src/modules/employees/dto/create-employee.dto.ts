// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS — decoradores de "class-validator"
// ─────────────────────────────────────────────────────────────────────────────
// class-validator es la librería que valida automáticamente los datos que llegan
// en el cuerpo (body) de una petición. Cada decorador "@" puesto sobre una
// propiedad impone una regla; si el dato no cumple, NestJS responde error 400.
//   - Allow: marca una propiedad como permitida SIN validarla (no la borra el
//     "whitelist" del ValidationPipe). Útil para campos que pueden ser null.
//   - IsBoolean: exige que el valor sea true/false.
//   - IsEmail: exige que sea un correo electrónico válido.
//   - IsOptional: la propiedad puede venir o no; si no viene, no se valida.
//   - IsString: exige que el valor sea texto.
//   - IsUUID: exige que sea un identificador UUID (con la versión indicada).
//   - MinLength: exige una longitud mínima de caracteres.
import {
  Allow,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

// DTO ("Data Transfer Object") = la "forma" esperada de los datos que llegan al
// crear un empleado. Define qué campos existen y cómo deben validarse.
export class CreateEmployeeDto {
  // Nombre: texto obligatorio de al menos 1 carácter (no puede ir vacío).
  @IsString()
  @MinLength(1)
  firstName: string;

  // Apellido: igual que el nombre, obligatorio y mínimo 1 carácter.
  @IsString()
  @MinLength(1)
  lastName: string;

  // Email: opcional ("?"); si viene, debe ser un correo válido.
  @IsOptional()
  @IsEmail()
  email?: string;

  // Teléfono: opcional; si viene, debe ser texto.
  @IsOptional()
  @IsString()
  phone?: string;

  // Bio (descripción del profesional): opcional, texto.
  @IsOptional()
  @IsString()
  bio?: string;

  // locationId: la sucursal donde trabaja. Obligatorio y debe ser un UUID v4.
  @IsUUID('4')
  locationId: string;

  // isActive: opcional; indica si el empleado está activo. Si viene, true/false.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // color: opcional; el color del empleado para pintar su avatar/calendario.
  @IsOptional()
  @IsString()
  color?: string;

  // userId: opcional; si el empleado tiene cuenta de usuario, su UUID v4.
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  // managerId: el jefe/supervisor del empleado. Con @Allow() lo aceptamos sin
  // validación de formato porque puede ser un UUID, una cadena vacía o null.
  // "string | null" indica que el tipo puede ser texto o nulo.
  @Allow()
  managerId?: string | null;
}

// DTO para ACTUALIZAR un empleado. Todos los campos son opcionales: solo se
// envían los que se quieren cambiar (no hay que mandar el objeto completo).
export class UpdateEmployeeDto {
  // Nombre: opcional; si viene, texto.
  @IsOptional()
  @IsString()
  firstName?: string;

  // Apellido: opcional; si viene, texto.
  @IsOptional()
  @IsString()
  lastName?: string;

  // Email: opcional; si viene, correo válido.
  @IsOptional()
  @IsEmail()
  email?: string;

  // Teléfono: opcional; si viene, texto.
  @IsOptional()
  @IsString()
  phone?: string;

  // Bio: opcional; si viene, texto.
  @IsOptional()
  @IsString()
  bio?: string;

  // isActive: opcional; si viene, booleano.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // color: opcional; si viene, texto.
  @IsOptional()
  @IsString()
  color?: string;

  // jobTitle (puesto/cargo): opcional; si viene, texto.
  @IsOptional()
  @IsString()
  jobTitle?: string;

  // posEnabled: opcional; si viene, booleano. Activa/desactiva el acceso del
  // empleado al Punto de Venta (lo gestiona el admin desde la consola).
  @IsOptional()
  @IsBoolean()
  posEnabled?: boolean;

  // managerId: igual que en crear, se acepta sin validar formato.
  @Allow()
  managerId?: string | null;
}
