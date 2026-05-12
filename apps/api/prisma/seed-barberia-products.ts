/**
 * seed-barberia-products.ts
 *
 * Migra los 9 productos de la "Barbería Continental" (en realidad guardados en
 * el Demo Salon local del usuario) al tenant Demo Salon de produccion.
 *
 * Antes de crear los productos nuevos, BORRA todos los productos existentes del
 * tenant Demo Salon en produccion. Esto incluye los productos generados por
 * seed-demo.ts y seed-products.ts.
 *
 * Las imagenes viven en prisma/migration-assets/barberia-products/ y son
 * copiadas a uploads/products/ del repo (servido en /api/uploads/products/...).
 *
 * Uso: cd apps/api && npm run db:seed-barberia
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// uploads/ vive en la raiz del repo (dos niveles arriba de apps/api/).
const UPLOADS_BASE = path.resolve(__dirname, '..', '..', '..', 'uploads');
const ASSETS_DIR = path.resolve(__dirname, 'migration-assets', 'barberia-products');

interface ProductSpec {
  name: string;
  sku: string;
  description: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  currency: string;
  imageFile: string; // archivo en ASSETS_DIR
  supplierUrl?: string;
  shippingEnabled?: boolean;
  shippingCost?: number;
  isShopListed?: boolean;
}

const PRODUCTS: ProductSpec[] = [
  {
    name: 'Bálsamo Activador de Crecimiento de Barba',
    sku: '2323232',
    description: 'Bálsamo Activador de Crecimiento de Barba con Biotina Alta Concentración y Bergamota 20% | Estimulante para Hombres | Hace Crecer Vello Facial donde no había | Cierra Huecos y da Densidad | Tratamiento 1 Mes',
    category: 'Producto para la barba',
    price: 700.00,
    costPrice: 650.00,
    stock: 9,
    minStock: 0,
    unit: 'pieza',
    currency: 'MXN',
    imageFile: '9d5354b9-fd47-4f03-a420-e8f79ecf1537.jpg',
    shippingEnabled: false,
    shippingCost: 25.00,
    isShopListed: true,
  },
  {
    name: 'Minoxidilmax',
    sku: '23232323',
    description: 'Minoxidilmax tratamiento cosmético auxiliar para el crecimiento de Cabello y Barba, Minoxidil 15%, Bergamota, Biotina',
    category: 'Producto para la barba',
    price: 250.00,
    costPrice: 179.00,
    stock: 10,
    minStock: 2,
    unit: 'pieza',
    currency: 'MXN',
    imageFile: '9aead782-78b6-4a20-856f-69039a32ae12.png',
    supplierUrl: 'https://www.amazon.com.mx/sp?ie=UTF8&seller=A34FTOACPF0D6E&asin=B0G76XWB5B&ref_=dp_merchant_link&isAmazonFulfilled=1',
    shippingEnabled: false,
    isShopListed: true,
  },
  {
    name: 'Anacastel Minoxidil',
    sku: '23242512',
    description: 'Anacastel Minoxidil Solución 5% | Tratamiento Capilar Anticaída Cabello I Minoxidil Barba y Bigote I Alopecia Androgénetica | Alarga Fase de Crecimiento del Cabello I Formato Spray | 60ml',
    category: 'Producto para la barba',
    price: 350.00,
    costPrice: 225.00,
    stock: 2,
    minStock: 1,
    unit: 'pieza',
    currency: 'MXN',
    imageFile: 'e2a584fc-ac29-4360-9e4d-f15f06ab01e7.jpg',
    shippingEnabled: false,
    isShopListed: true,
  },
  {
    name: 'Kit para Barba',
    sku: '2321235',
    description: 'Kit para Barba Hombre, Cepillo, Peine y Tijeras, Set de Cuidado para Barba y Bigote, Ideal para Recortar, Moldear y Arreglar Barbas, Regalo para Hombres',
    category: 'Producto para la barba',
    price: 350.00,
    costPrice: 219.00,
    stock: 2,
    minStock: 2,
    unit: 'pieza',
    currency: 'MXN',
    imageFile: '0cff60d4-c2fc-4f85-b688-464e29cfe4f2.jpg',
    supplierUrl: 'https://www.amazon.com.mx/Cepillo-Tijeras-Cuidado-Recortar-Arreglar/dp/B0FGJMGR5V',
    shippingEnabled: true,
    isShopListed: true,
  },
  {
    name: 'Peine para barba y guía modeladora de corte para hombre',
    sku: '4545435354',
    description: 'Timotech Peine para barba y guía modeladora de corte para hombre | Accesorio para modelar barba y cuidado de cabello facial | Set de cuidado del cabello facial para alineación perfecta (2 piezas)',
    category: 'Producto para la barba',
    price: 300.00,
    costPrice: 149.00,
    stock: 4,
    minStock: 2,
    unit: 'pieza',
    currency: 'MXN',
    imageFile: 'be9e87c0-f886-42c8-b6cb-01359d409844.jpg',
    supplierUrl: 'https://www.amazon.com.mx/Timotech-modeladora-Accesorio-alineaci%C3%B3n-perfecta/dp/B09BXTTLTK',
    shippingEnabled: false,
    isShopListed: true,
  },
  {
    name: 'Pomada para Peinar FIX YOUR LID',
    sku: '323232331',
    description: 'FIX YOUR LID, Pomada para Peinar, Fijación Media, Ideal para Hombres y Todo Tipo de Peinados, Brillo Alto, 3.75 Onzas',
    category: 'Producto para el cabello',
    price: 300.00,
    costPrice: 187.00,
    stock: 4,
    minStock: 2,
    unit: 'pieza',
    currency: 'MXN',
    imageFile: 'e8d37f78-b3ce-472a-b880-9a60e57955ea.jpg',
    supplierUrl: 'https://www.amazon.com.mx/Pomada-Peinar-Fijaci%C3%B3n-Hombres-Peinados/dp/B07C52RMCX',
    shippingEnabled: true,
    isShopListed: true,
  },
  {
    name: 'Gel para cabello Barcelona Pharma',
    sku: '345231123',
    description: 'Barcelona Pharma | Gel para cabello para hombre | Barber | Fijación firme | Sin alcohol | Sin residuos (700g)',
    category: 'Producto para el cabello',
    price: 350.00,
    costPrice: 299.00,
    stock: 12,
    minStock: 1,
    unit: 'pieza',
    currency: 'MXN',
    imageFile: 'e5381abb-ea63-45eb-9331-1016e07a48c9.jpg',
    supplierUrl: 'https://www.amazon.com.mx/Barcelona-Pharma-cabello-Fijaci%C3%B3n-residuos/dp/B0GQJVT1VK',
    shippingEnabled: false,
    isShopListed: true,
  },
  {
    name: 'Cera para el cabello L3 Nivel 3 Spider Wax',
    sku: '353453453',
    description: 'Cera para el cabello L3 Nivel 3 Spider Wax - Fijación fuerte y duradera. Mejora el volumen y la textura de tu cabello. Cera para el cabello Nivel Tres para hombres (150 ml, Spider Wax).',
    category: 'Producto para el cabello',
    price: 460.00,
    costPrice: 360.00,
    stock: 3,
    minStock: 2,
    unit: 'pieza',
    currency: 'MXN',
    imageFile: '81660d88-f0d0-4b20-8d4d-3dd9e82dc1fa.jpg',
    supplierUrl: 'https://www.amazon.com.mx/Nivel-Spider-Wax-duraci%C3%B3n-volumen/dp/B08SNMGB3B',
    shippingEnabled: false,
    isShopListed: false,
  },
  {
    name: 'Cera para el cabello L3 Nivel 3 Spider Wax (variante 2)',
    sku: '35335435',
    description: 'Cera para el cabello L3 Nivel 3 Spider Wax - Fijación fuerte y duradera. Mejora el volumen y la textura de tu cabello. Cera para el cabello Nivel Tres para hombres (150 ml, Spider Wax).',
    category: 'Producto para el cabello',
    price: 460.00,
    costPrice: 360.00,
    stock: 5,
    minStock: 1,
    unit: 'pieza',
    currency: 'MXN',
    imageFile: '5c2a6a26-387e-4aed-9419-6c2a1e7c8953.jpg',
    supplierUrl: 'https://www.amazon.com.mx/Nivel-Spider-Wax-duraci%C3%B3n-volumen/dp/B08SNMGB3B',
    shippingEnabled: false,
    isShopListed: true,
  },
];

async function copyImage(file: string): Promise<string | null> {
  const src = path.join(ASSETS_DIR, file);
  const destDir = path.join(UPLOADS_BASE, 'products');
  const dest = path.join(destDir, file);

  if (!fs.existsSync(src)) {
    console.warn(`  ⚠️  No existe el asset: ${src}`);
    return null;
  }
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  return `/api/uploads/products/${file}`;
}

async function main() {
  console.log('💈 Migracion: productos Barberia → Demo Salon\n');

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo-salon' } });
  if (!tenant) {
    console.error('❌ Tenant "demo-salon" no encontrado. Corre db:seed primero.');
    process.exit(1);
  }
  console.log(`✓ Tenant: ${tenant.name} (${tenant.id})\n`);

  // 1) Borrar todos los productos existentes del tenant.
  const existing = await prisma.product.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, name: true, imageUrl: true },
  });

  if (existing.length > 0) {
    console.log(`🗑️  Borrando ${existing.length} productos previos del tenant...`);
    // Borrar primero relaciones que dependen del producto: imágenes, reservas, etc.
    // Schema: ProductImage, ProductReservation tienen onDelete: Cascade vía Prisma → Mariadb
    await prisma.product.deleteMany({ where: { tenantId: tenant.id } });
    console.log(`   ✓ Eliminados.\n`);
  } else {
    console.log('   (no había productos previos)\n');
  }

  // 2) Crear los 9 productos nuevos copiando las imágenes desde migration-assets.
  console.log('📦 Creando productos:');
  let created = 0;
  for (const p of PRODUCTS) {
    const imageUrl = await copyImage(p.imageFile);
    try {
      await prisma.product.create({
        data: {
          tenantId: tenant.id,
          name: p.name,
          sku: p.sku,
          description: p.description,
          category: p.category,
          price: p.price,
          costPrice: p.costPrice,
          stock: p.stock,
          minStock: p.minStock,
          unit: p.unit,
          currency: p.currency,
          imageUrl,
          supplierUrl: p.supplierUrl ?? null,
          shippingEnabled: p.shippingEnabled ?? false,
          shippingCost: p.shippingCost ?? null,
          isShopListed: p.isShopListed ?? true,
          isActive: true,
        },
      });
      created++;
      console.log(`  ✓ ${p.name} — $${p.price} · stock ${p.stock}`);
    } catch (err: any) {
      console.error(`  ❌ ${p.name}: ${err.message}`);
    }
  }

  const total = await prisma.product.count({ where: { tenantId: tenant.id } });
  console.log(`\n📊 Resumen:`);
  console.log(`   Creados: ${created}/${PRODUCTS.length}`);
  console.log(`   Total productos del tenant ahora: ${total}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('💥 Error fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
