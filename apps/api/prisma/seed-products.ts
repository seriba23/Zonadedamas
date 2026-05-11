/**
 * seed-products.ts
 * Agrega 20 productos realistas con fotos al tenant Demo Salon.
 * Idempotente: salta productos que ya existen por (tenantId, name).
 *
 * Uso: cd apps/api && npm run db:seed-products
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const prisma = new PrismaClient();
const UPLOADS_BASE = path.resolve(__dirname, '..', '..', '..', 'uploads');

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = fs.createWriteStream(destPath);
    const makeRequest = (reqUrl: string, redirectCount = 0) => {
      if (redirectCount > 10) { reject(new Error('Too many redirects')); return; }
      const client = reqUrl.startsWith('https') ? https : http;
      client.get(reqUrl, (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          let redirectUrl = response.headers.location;
          if (redirectUrl.startsWith('/')) {
            const parsed = new URL(reqUrl);
            redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
          }
          makeRequest(redirectUrl, redirectCount + 1);
          return;
        }
        if (response.statusCode !== 200) { reject(new Error(`HTTP ${response.statusCode}`)); return; }
        response.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
    };
    makeRequest(url);
  });
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function tryDownload(imageUrls: string[], filename: string): Promise<string | null> {
  const destAbs = path.join(UPLOADS_BASE, 'products', filename);
  for (const url of imageUrls) {
    try {
      await downloadFile(url, destAbs);
      return `/api/uploads/products/${filename}`;
    } catch (err: any) {
      console.warn(`  ⚠️  falló ${url.slice(0, 60)}...: ${err.message}`);
    }
  }
  return null;
}

// Imagenes via loremflickr (filtra por keywords). Acepta varios tags
// separados por coma. Fallback a una variante mas generica si la primera falla.
function flickr(keywords: string, lock: number): string {
  return `https://loremflickr.com/500/500/${keywords}?lock=${lock}`;
}

const PRODUCTS = [
  // Cuidado capilar
  { name: 'Shampoo Hidratante Argán 500ml', sku: 'SHA-ARG-500', category: 'Cuidado Capilar', price: 28.50, costPrice: 14.00, stock: 24, minStock: 5, unit: 'botella', description: 'Shampoo enriquecido con aceite de argán para cabellos secos y dañados.',
    imageUrls: [flickr('shampoo,bottle', 101), flickr('shampoo', 102), flickr('haircare,bottle', 103)] },
  { name: 'Acondicionador Reparador Keratina 500ml', sku: 'ACO-KER-500', category: 'Cuidado Capilar', price: 32.00, costPrice: 16.00, stock: 18, minStock: 5, unit: 'botella', description: 'Restaura la fibra capilar con keratina hidrolizada.',
    imageUrls: [flickr('conditioner,hair', 201), flickr('haircare,bottle', 202), flickr('shampoo', 203)] },
  { name: 'Mascarilla Capilar Intensiva 250ml', sku: 'MAS-CAP-250', category: 'Cuidado Capilar', price: 22.00, costPrice: 11.00, stock: 30, minStock: 8, unit: 'pote', description: 'Tratamiento profundo semanal para cabello procesado.',
    imageUrls: [flickr('hairmask,jar', 301), flickr('haircare,treatment', 302), flickr('cosmetic,jar', 303)] },
  { name: 'Aceite Capilar Multifunción 100ml', sku: 'ACE-MUL-100', category: 'Cuidado Capilar', price: 18.50, costPrice: 9.00, stock: 22, minStock: 5, unit: 'frasco', description: 'Sérum ligero con vitaminas E y B5, sin enjuague.',
    imageUrls: [flickr('hairoil,serum', 401), flickr('beautyoil,bottle', 402), flickr('cosmetic,oil', 403)] },
  { name: 'Tinte Profesional Tono Castaño', sku: 'TIN-PRO-CAS', category: 'Coloración', price: 14.00, costPrice: 7.00, stock: 45, minStock: 10, unit: 'caja', description: 'Coloración permanente con tecnología anti-irritante.',
    imageUrls: [flickr('haircolor,box', 501), flickr('haircolor,dye', 502), flickr('hairdye', 503)] },
  { name: 'Decolorante en Polvo 500g', sku: 'DEC-POL-500', category: 'Coloración', price: 24.00, costPrice: 12.00, stock: 12, minStock: 4, unit: 'bote', description: 'Polvo decolorante de alta performance para mechas y aclarados.',
    imageUrls: [flickr('hairbleach,powder', 601), flickr('haircolor,salon', 602), flickr('cosmetic,powder', 603)] },
  { name: 'Oxidante Crema 30 vol 1L', sku: 'OXI-30V-1L', category: 'Coloración', price: 16.00, costPrice: 8.00, stock: 20, minStock: 6, unit: 'botella', description: 'Activador para tintes y decoloraciones.',
    imageUrls: [flickr('hairdeveloper,bottle', 701), flickr('haircolor,activator', 702), flickr('hairsalon,bottle', 703)] },

  // Manicure / pedicure
  { name: 'Esmalte Semi-permanente Nude', sku: 'ESM-SEM-NUD', category: 'Uñas', price: 12.00, costPrice: 5.50, stock: 35, minStock: 10, unit: 'frasco', description: 'Esmalte de gel curado en LED, duración hasta 3 semanas.',
    imageUrls: [flickr('nailpolish,nude', 801), flickr('nailpolish,bottle', 802), flickr('manicure,polish', 803)] },
  { name: 'Esmalte Semi-permanente Rojo Pasión', sku: 'ESM-SEM-RED', category: 'Uñas', price: 12.00, costPrice: 5.50, stock: 28, minStock: 10, unit: 'frasco', description: 'Color clásico de alto brillo, larga duración.',
    imageUrls: [flickr('nailpolish,red', 901), flickr('nailpolish,bottle', 902), flickr('manicure,red', 903)] },
  { name: 'Top Coat Brillo Diamante 15ml', sku: 'TOP-DIA-015', category: 'Uñas', price: 14.00, costPrice: 7.00, stock: 26, minStock: 8, unit: 'frasco', description: 'Sellador con efecto cristal y resistencia extra.',
    imageUrls: [flickr('nailpolish,clear', 1001), flickr('manicure,topcoat', 1002), flickr('nailpolish,bottle', 1003)] },
  { name: 'Removedor de Esmalte sin Acetona 250ml', sku: 'REM-SAC-250', category: 'Uñas', price: 8.00, costPrice: 4.00, stock: 50, minStock: 15, unit: 'botella', description: 'Fórmula suave con vitamina E.',
    imageUrls: [flickr('nailpolishremover,bottle', 1101), flickr('manicure,remover', 1102), flickr('cosmetic,bottle', 1103)] },

  // Skincare
  { name: 'Crema Facial Hidratante 50ml', sku: 'CRE-HID-050', category: 'Skincare', price: 38.00, costPrice: 19.00, stock: 16, minStock: 5, unit: 'tarro', description: 'Hidratación profunda con ácido hialurónico y niacinamida.',
    imageUrls: [flickr('facecream,jar', 1201), flickr('moisturizer,skincare', 1202), flickr('cosmetic,jar', 1203)] },
  { name: 'Sérum Vitamina C 30ml', sku: 'SER-VIC-030', category: 'Skincare', price: 42.00, costPrice: 21.00, stock: 14, minStock: 4, unit: 'frasco', description: 'Antioxidante potente que ilumina y unifica el tono.',
    imageUrls: [flickr('serum,dropper', 1301), flickr('skincare,serum', 1302), flickr('cosmetic,bottle', 1303)] },
  { name: 'Mascarilla Facial de Arcilla 100g', sku: 'MAS-ARC-100', category: 'Skincare', price: 18.00, costPrice: 9.00, stock: 22, minStock: 6, unit: 'tarro', description: 'Purifica y elimina impurezas, ideal para piel mixta y grasa.',
    imageUrls: [flickr('claymask,facial', 1401), flickr('skincare,mask', 1402), flickr('cosmetic,jar', 1403)] },

  // Maquillaje
  { name: 'Base Líquida Matte Tono Medio 30ml', sku: 'BAS-MAT-MED', category: 'Maquillaje', price: 26.00, costPrice: 13.00, stock: 18, minStock: 5, unit: 'frasco', description: 'Cobertura buildable con acabado natural sin brillos.',
    imageUrls: [flickr('foundation,makeup', 1501), flickr('liquidfoundation,bottle', 1502), flickr('makeup,cosmetic', 1503)] },
  { name: 'Labial Mate Larga Duración Vino', sku: 'LAB-MAT-VIN', category: 'Maquillaje', price: 16.00, costPrice: 8.00, stock: 24, minStock: 8, unit: 'pieza', description: 'Color intenso de 8 horas de duración sin transferencia.',
    imageUrls: [flickr('lipstick,red', 1601), flickr('lipstick,makeup', 1602), flickr('cosmetic,lipstick', 1603)] },

  // Herramientas
  { name: 'Plancha Profesional Titanio 230°C', sku: 'PLA-PRO-230', category: 'Herramientas', price: 95.00, costPrice: 60.00, stock: 6, minStock: 2, unit: 'pieza', description: 'Placas de titanio anti-frizz con control digital.',
    imageUrls: [flickr('hairstraightener,flatiron', 1701), flickr('hairtool,straightener', 1702), flickr('hairsalon,tool', 1703)] },
  { name: 'Secador Iónico 2000W', sku: 'SEC-ION-2K', category: 'Herramientas', price: 78.00, costPrice: 48.00, stock: 5, minStock: 2, unit: 'pieza', description: 'Tecnología iónica para secado rápido y cabello sedoso.',
    imageUrls: [flickr('hairdryer,blowdryer', 1801), flickr('hairtool,dryer', 1802), flickr('hairsalon,tool', 1803)] },
  { name: 'Set de Cepillos Profesionales (5 pzas)', sku: 'CEP-SET-005', category: 'Herramientas', price: 34.00, costPrice: 17.00, stock: 10, minStock: 3, unit: 'set', description: 'Variedad de cepillos térmicos y desenredantes.',
    imageUrls: [flickr('hairbrush,brushes', 1901), flickr('hairtool,brush', 1902), flickr('hairsalon,brush', 1903)] },

  // Accesorios
  { name: 'Capa para Corte Profesional', sku: 'CAP-COR-PRO', category: 'Accesorios', price: 22.00, costPrice: 11.00, stock: 8, minStock: 3, unit: 'pieza', description: 'Tela impermeable y ligera con cierre ajustable.',
    imageUrls: [flickr('haircape,salon', 2001), flickr('hairsalon,cape', 2002), flickr('barbershop,cape', 2003)] },
];

async function main() {
  console.log('🛍️  Agregando productos demo a Demo Salon\n');

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo-salon' } });
  if (!tenant) {
    console.error('❌ Tenant "demo-salon" no encontrado. Corre db:seed primero.');
    process.exit(1);
  }
  console.log(`✓ Tenant: ${tenant.name} (${tenant.id})\n`);

  // Pick a random existing supplier to associate with the products (optional)
  const suppliers = await prisma.supplier.findMany({
    where: { tenantId: tenant.id, isActive: true },
    select: { id: true, name: true },
  });
  console.log(`✓ ${suppliers.length} proveedores disponibles para vincular\n`);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const [i, p] of PRODUCTS.entries()) {
    const existing = await prisma.product.findFirst({
      where: { tenantId: tenant.id, name: p.name },
      select: { id: true, imageUrl: true },
    });

    // Descarga la imagen tematica nueva (reemplaza la generica anterior).
    const filename = `demo-prod-extra-${i + 1}.jpg`;
    const imageUrl = await tryDownload(p.imageUrls, filename);

    if (existing) {
      if (imageUrl) {
        await prisma.product.update({
          where: { id: existing.id },
          data: { imageUrl },
        });
        updated++;
        console.log(`↻ Imagen actualizada: ${p.name}`);
      } else {
        console.log(`→ ${p.name} (ya existe, descarga fallo, sin cambios)`);
      }
      await delay(120);
      continue;
    }

    const supplier = suppliers.length > 0 ? suppliers[i % suppliers.length] : null;

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
          supplierId: supplier?.id ?? null,
          currency: 'MXN',
          imageUrl,
          isShopListed: true,
          isActive: true,
        },
      });
      created++;
      console.log(`✓ Creado: ${p.name}${supplier ? ` (proveedor: ${supplier.name})` : ''}`);
    } catch (err: any) {
      failed++;
      console.error(`❌ Error creando "${p.name}": ${err.message}`);
    }

    await delay(120);
  }

  console.log('\n📊 Resumen:');
  console.log(`   Creados:     ${created}`);
  console.log(`   Imagen upd.: ${updated}`);
  console.log(`   Fallos:      ${failed}`);
  console.log(`   Total productos del tenant ahora: ${await prisma.product.count({ where: { tenantId: tenant.id } })}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('💥 Error fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
