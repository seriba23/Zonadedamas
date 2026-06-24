// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS: los mismos decoradores de validación de class-validator que en el DTO de
// creación. (Ver create-product.dto.ts para el detalle de cada uno.)
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// UpdateProductDto: forma de los datos para ACTUALIZAR un producto. A diferencia
// del DTO de creación, AQUÍ TODOS los campos son opcionales (todos llevan "?" y
// @IsOptional): el cliente envía solo los campos que quiere cambiar y el servicio
// deja intactos los que no se envían.
export class UpdateProductDto {
  // name: si se envía, debe ser texto y no estar vacío (mínimo 1 carácter).
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  // commission: valor de comisión. Opcional, número >= 0.
  @IsOptional()
  @IsNumber()
  @Min(0)
  commission?: number;

  // commissionType: tipo de comisión ('AMOUNT' o 'PERCENT'). Opcional, texto.
  @IsOptional()
  @IsString()
  commissionType?: string;

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

  // price: precio de venta. Opcional, número >= 0.
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  // costPrice: costo de compra. Opcional, número >= 0.
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  // stock: unidades disponibles. Opcional, número >= 0.
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  // minStock: mínimo deseado (umbral de stock bajo). Opcional, número >= 0.
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  // unit: unidad de medida. Opcional, texto.
  @IsOptional()
  @IsString()
  unit?: string;

  // currency: moneda. Opcional, texto.
  @IsOptional()
  @IsString()
  currency?: string;

  // supplierId: id del proveedor. Opcional, texto.
  @IsOptional()
  @IsString()
  supplierId?: string;

  // supplierUrl: enlace al proveedor. Opcional, texto.
  @IsOptional()
  @IsString()
  supplierUrl?: string;

  // notes: notas internas. Opcional, texto.
  @IsOptional()
  @IsString()
  notes?: string;

  // shippingEnabled: si admite envío. Opcional, booleano.
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

  // isActive: si está activo. Opcional, booleano.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
