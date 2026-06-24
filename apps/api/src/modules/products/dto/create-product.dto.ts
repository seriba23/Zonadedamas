// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: "decoradores de validación" de la librería class-validator. Cada uno se
// pone arriba de una propiedad y obliga a que el dato cumpla una regla; si no la
// cumple, NestJS rechaza la petición con error 400 automáticamente.
//   - IsBoolean: el valor debe ser true/false.
//   - IsNumber: el valor debe ser un número.
//   - IsOptional: el campo puede faltar (si falta, no se valida nada más).
//   - IsString: el valor debe ser texto.
//   - Min: el número debe ser >= al mínimo indicado.
//   - MinLength: el texto debe tener al menos esa cantidad de caracteres.
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// CreateProductDto: describe y valida la FORMA de los datos para CREAR un producto.
// Los campos sin "?" son obligatorios; los que tienen "?" (y @IsOptional) opcionales.
export class CreateProductDto {
  // name: obligatorio, debe ser texto y tener al menos 1 carácter (no vacío).
  @IsString()
  @MinLength(1)
  name: string;

  // sku: código del producto. Opcional, texto.
  @IsOptional()
  @IsString()
  sku?: string;

  // description: descripción. Opcional, texto.
  @IsOptional()
  @IsString()
  description?: string;

  // category: categoría. Opcional, texto.
  @IsOptional()
  @IsString()
  category?: string;

  // price: precio de venta. Obligatorio, número y no negativo (Min 0).
  @IsNumber()
  @Min(0)
  price: number;

  // costPrice: costo de compra. Opcional, número >= 0.
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  // commission: valor de la comisión del vendedor. Opcional, número >= 0.
  // Su significado (monto fijo o porcentaje) depende de commissionType (abajo).
  @IsOptional()
  @IsNumber()
  @Min(0)
  commission?: number;

  // commissionType: tipo de comisión ('AMOUNT' = monto fijo o 'PERCENT' = porcentaje).
  // Opcional, texto. (En el servicio, por defecto es 'AMOUNT' si no se envía.)
  @IsOptional()
  @IsString()
  commissionType?: string;

  // stock: unidades disponibles. Opcional, número >= 0.
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  // minStock: mínimo deseado; por debajo se considera "stock bajo". Opcional, >= 0.
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  // unit: unidad de medida (pieza, ml, etc.). Opcional, texto.
  @IsOptional()
  @IsString()
  unit?: string;

  // currency: moneda (ej. 'MXN'). Opcional, texto.
  @IsOptional()
  @IsString()
  currency?: string;

  // supplierId: id del proveedor asociado. Opcional, texto.
  @IsOptional()
  @IsString()
  supplierId?: string;

  // supplierUrl: enlace al producto en la web del proveedor. Opcional, texto.
  @IsOptional()
  @IsString()
  supplierUrl?: string;

  // notes: notas internas. Opcional, texto.
  @IsOptional()
  @IsString()
  notes?: string;

  // shippingEnabled: si el producto admite envío. Opcional, booleano.
  @IsOptional()
  @IsBoolean()
  shippingEnabled?: boolean;

  // shippingCost: costo de envío. Opcional, número >= 0.
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingCost?: number;

  // isShopListed: si aparece en la tienda online. Opcional, booleano.
  @IsOptional()
  @IsBoolean()
  isShopListed?: boolean;

  // isActive: si el producto está activo. Opcional, booleano.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
