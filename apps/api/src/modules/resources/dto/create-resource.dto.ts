// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: traemos los "validadores" de la librería class-validator.
// Un DTO (Data Transfer Object) es un "molde" que describe qué datos esperamos
// recibir del cliente y QUÉ REGLAS deben cumplir. Cada decorador "@" de abajo es
// una regla automática: si el dato no la cumple, NestJS rechaza la petición con
// un error 400 (petición inválida) ANTES de que llegue a la lógica del servicio.
// ─────────────────────────────────────────────────────────────────────────────
import {
  // @Allow(): marca un campo como "permitido sin validación". Útil cuando el
  // campo tiene una forma libre (ej. un objeto) que no encaja en los validadores
  // simples. Sin esta etiqueta, NestJS podría descartar el campo en modo estricto.
  Allow,
  // @IsBoolean(): exige que el valor sea true/false (un booleano).
  IsBoolean,
  // @IsInt(): exige que el valor sea un número ENTERO (sin decimales).
  IsInt,
  // @IsNumber(): exige que el valor sea un número (admite decimales).
  IsNumber,
  // @IsOptional(): marca el campo como OPCIONAL. Si no viene, no se valida; si
  // viene, sí se aplican los demás validadores que tenga encima/debajo.
  IsOptional,
  // @IsString(): exige que el valor sea texto (una cadena de caracteres).
  IsString,
  // @IsUUID(): exige que el valor sea un identificador único con formato UUID.
  IsUUID,
  // @Min(n): exige que el número sea como mínimo "n" (mayor o igual que n).
  Min,
  // @MinLength(n): exige que el texto tenga al menos "n" caracteres de largo.
  MinLength,
} from 'class-validator';

// ─────────────────────────────────────────────────────────────────────────────
// CreateResourceDto: el molde para CREAR un recurso nuevo (equipo/material del
// negocio). Describe todos los campos que el cliente puede enviar al crear.
// ─────────────────────────────────────────────────────────────────────────────
export class CreateResourceDto {
  // name = nombre del recurso. Es OBLIGATORIO (no tiene @IsOptional).
  // @IsString => debe ser texto. @MinLength(1) => al menos 1 carácter (no vacío).
  @IsString()
  @MinLength(1)
  name: string;

  // description = descripción libre del recurso. El "?" indica que es opcional
  // en TypeScript; @IsOptional lo confirma para el validador.
  @IsOptional()
  @IsString()
  description?: string;

  // notes = notas internas adicionales. Opcional y de tipo texto.
  @IsOptional()
  @IsString()
  notes?: string;

  // type = categoría/tipo del recurso (ej. "máquina", "mueble"). Opcional, texto.
  @IsOptional()
  @IsString()
  type?: string;

  // imageUrl = URL de la imagen principal del recurso. Opcional, texto.
  @IsOptional()
  @IsString()
  imageUrl?: string;

  // imageUrl2 = URL de una segunda imagen (galería). Opcional, texto.
  @IsOptional()
  @IsString()
  imageUrl2?: string;

  // imageUrl3 = URL de una tercera imagen (galería). Opcional, texto.
  @IsOptional()
  @IsString()
  imageUrl3?: string;

  // value = valor monetario/costo del recurso. Opcional, número.
  // @Min(0) => no puede ser negativo (mínimo 0).
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  // quantity = cantidad total de unidades de este recurso. Opcional, entero.
  // @Min(1) => si viene, debe ser al menos 1 unidad.
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  // locationQuantities = un objeto que reparte la cantidad por sucursal, con la
  // forma { "idSucursal": cantidad }. Record<string, number> significa
  // "claves de tipo texto con valores de tipo número". Usamos @Allow() porque es
  // un objeto de forma libre que no encaja en un validador simple.
  @Allow()
  locationQuantities?: Record<string, number>;

  // serialNumber = número de serie del equipo. Opcional, texto.
  @IsOptional()
  @IsString()
  serialNumber?: string;

  // brand = marca del equipo. Opcional, texto.
  @IsOptional()
  @IsString()
  brand?: string;

  // condition = estado físico ("good", "fair", etc.). Opcional, texto.
  @IsOptional()
  @IsString()
  condition?: string;

  // assignedTo = a qué empleado está asignado el recurso (su id) o null si no
  // está asignado a nadie. "string | null" admite ambos. @Allow() porque el
  // valor null no encaja bien con los validadores estrictos de texto.
  @Allow()
  assignedTo?: string | null;

  // purchaseDate = fecha de compra, como TEXTO con formato "AAAA-MM-DD".
  // (El servicio lo convierte luego a fecha real.) Opcional, texto.
  @IsOptional()
  @IsString()
  purchaseDate?: string;

  // locationId = id de la sucursal donde vive el recurso. Es OBLIGATORIO.
  // @IsUUID('4') => debe ser un UUID válido de la versión 4.
  @IsUUID('4')
  locationId: string;

  // isActive = si el recurso está activo (visible) o desactivado. Opcional,
  // booleano (true/false).
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// UpdateResourceDto: el molde para ACTUALIZAR un recurso existente. Es casi
// igual al de crear, PERO aquí TODOS los campos son opcionales (cada uno tiene
// @IsOptional), porque al editar el cliente envía solo lo que quiere cambiar.
// ─────────────────────────────────────────────────────────────────────────────
export class UpdateResourceDto {
  // name = nuevo nombre. Aquí sí es opcional; si viene, debe ser texto no vacío.
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  // description = nueva descripción. Opcional, texto.
  @IsOptional()
  @IsString()
  description?: string;

  // notes = nuevas notas internas. Opcional, texto.
  @IsOptional()
  @IsString()
  notes?: string;

  // type = nuevo tipo/categoría. Opcional, texto.
  @IsOptional()
  @IsString()
  type?: string;

  // imageUrl = nueva URL de imagen principal. Opcional, texto.
  @IsOptional()
  @IsString()
  imageUrl?: string;

  // imageUrl2 = nueva URL de la segunda imagen. Opcional, texto.
  @IsOptional()
  @IsString()
  imageUrl2?: string;

  // imageUrl3 = nueva URL de la tercera imagen. Opcional, texto.
  @IsOptional()
  @IsString()
  imageUrl3?: string;

  // value = nuevo valor/costo. Opcional, número, mínimo 0.
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  // quantity = nueva cantidad total. Opcional, entero, mínimo 1.
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  // locationQuantities = nuevo reparto por sucursal. Opcional, objeto libre.
  @Allow()
  locationQuantities?: Record<string, number>;

  // serialNumber = nuevo número de serie. Opcional, texto.
  @IsOptional()
  @IsString()
  serialNumber?: string;

  // brand = nueva marca. Opcional, texto.
  @IsOptional()
  @IsString()
  brand?: string;

  // condition = nuevo estado físico. Opcional, texto.
  @IsOptional()
  @IsString()
  condition?: string;

  // assignedTo = nuevo empleado asignado (id) o null para desasignar. Libre.
  @Allow()
  assignedTo?: string | null;

  // purchaseDate = nueva fecha de compra (texto "AAAA-MM-DD"). Opcional, texto.
  @IsOptional()
  @IsString()
  purchaseDate?: string;

  // locationId = nueva sucursal. Opcional aquí; si viene, debe ser UUID v4.
  @IsOptional()
  @IsUUID('4')
  locationId?: string;

  // isActive = nuevo estado activo/inactivo. Opcional, booleano.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
