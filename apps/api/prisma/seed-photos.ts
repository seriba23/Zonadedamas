import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const prisma = new PrismaClient();

const UPLOADS_BASE = path.resolve(__dirname, '..', '..', '..', 'uploads');

// ─── BUSINESS CONFIG ────────────────────────────────────────────────────────
// Covers & gallery: loremflickr.com con keywords relevantes al tipo de negocio
// Employee avatars: i.pravatar.cc (fotos reales de personas)
// Logos: ui-avatars.com (iniciales estilizadas con color del negocio)

interface BusinessPhotoConfig {
  logoColor: string;       // background color for logo (hex sin #)
  coverKeywords: string;   // keywords for cover photo
  galleryKeywords: string[];  // keywords for each gallery photo
  employeeAvatarIds: number[]; // i.pravatar.cc img IDs (1-70)
  galleryCaptions: string[];
}

const BUSINESS_PHOTOS: Record<string, BusinessPhotoConfig> = {
  'bella-donna': {
    logoColor: 'e91e63',
    coverKeywords: 'hair+salon+interior',
    galleryKeywords: ['woman+hairstyle', 'hair+coloring+salon', 'blowdry+hair+styling'],
    employeeAvatarIds: [5, 9, 25],
    galleryCaptions: ['Peinado de novia', 'Coloración premium', 'Brushing profesional'],
  },
  'barberkings': {
    logoColor: '1565c0',
    coverKeywords: 'barbershop+interior',
    galleryKeywords: ['barber+haircut+man', 'beard+trim+barber', 'fade+haircut'],
    employeeAvatarIds: [11, 14],
    galleryCaptions: ['Corte degradado', 'Perfilado de barba', 'Fade premium'],
  },
  'zen-spa': {
    logoColor: '00897b',
    coverKeywords: 'spa+massage+candles',
    galleryKeywords: ['hot+stone+massage', 'spa+relaxation+pool', 'aromatherapy+oils'],
    employeeAvatarIds: [21, 23, 26],
    galleryCaptions: ['Masaje hot stones', 'Circuito de aguas', 'Aromaterapia'],
  },
  'derma-plus': {
    logoColor: '1565c0',
    coverKeywords: 'dermatology+clinic+modern',
    galleryKeywords: ['facial+treatment+clinic', 'skincare+treatment', 'medical+aesthetics'],
    employeeAvatarIds: [12, 32],
    galleryCaptions: ['Tratamiento facial', 'Cuidado de piel', 'Medicina estética'],
  },
  'nails-factory': {
    logoColor: 'e91e63',
    coverKeywords: 'nail+salon+manicure',
    galleryKeywords: ['nail+art+design', 'pedicure+spa+feet', 'gel+nails+colors'],
    employeeAvatarIds: [16, 20, 28],
    galleryCaptions: ['Nail art diseño', 'Pedicure spa', 'Uñas de gel'],
  },
  'corta-y-calla': {
    logoColor: 'd32f2f',
    coverKeywords: 'modern+barbershop',
    galleryKeywords: ['razor+shave+barber', 'men+grooming+style', 'barber+chair+vintage'],
    employeeAvatarIds: [51, 53, 56],
    galleryCaptions: ['Afeitado clásico', 'Estilo urbano', 'Silla vintage'],
  },
  'glow-beauty': {
    logoColor: 'ff6f00',
    coverKeywords: 'makeup+studio+beauty',
    galleryKeywords: ['bridal+makeup', 'eyelash+extension', 'eyebrow+microblading'],
    employeeAvatarIds: [1, 38],
    galleryCaptions: ['Maquillaje novia', 'Extensiones pestañas', 'Micropigmentación'],
  },
  'thai-harmony': {
    logoColor: 'ff6f00',
    coverKeywords: 'thai+spa+zen',
    galleryKeywords: ['thai+massage+traditional', 'foot+massage+reflexology', 'spa+candles+relax'],
    employeeAvatarIds: [44, 47],
    galleryCaptions: ['Masaje tailandés', 'Reflexología podal', 'Ambiente zen'],
  },
  'clinica-renovar': {
    logoColor: 'ad1457',
    coverKeywords: 'aesthetic+clinic+laser',
    galleryKeywords: ['laser+hair+removal', 'body+treatment+spa', 'facial+rejuvenation'],
    employeeAvatarIds: [10, 24, 29],
    galleryCaptions: ['Depilación láser', 'Tratamiento corporal', 'Rejuvenecimiento facial'],
  },
  'rizos-and-co': {
    logoColor: 'ff6f00',
    coverKeywords: 'curly+hair+salon',
    galleryKeywords: ['curly+hair+natural', 'braids+hairstyle+african', 'afro+hair+care'],
    employeeAvatarIds: [45, 48],
    galleryCaptions: ['Rizos definidos', 'Trenzas africanas', 'Cuidado afro'],
  },
};

// ─── DOWNLOAD HELPER ────────────────────────────────────────────────────────

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(destPath);

    const makeRequest = (reqUrl: string, redirectCount = 0) => {
      if (redirectCount > 10) {
        reject(new Error('Too many redirects'));
        return;
      }

      const client = reqUrl.startsWith('https') ? https : http;

      client.get(reqUrl, (response) => {
        // Follow redirects
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          let redirectUrl = response.headers.location;
          // Handle relative redirects
          if (redirectUrl.startsWith('/')) {
            const parsed = new URL(reqUrl);
            redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
          }
          makeRequest(redirectUrl, redirectCount + 1);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode} for ${reqUrl}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };

    makeRequest(url);
  });
}

// Small delay to be nice to free APIs
function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function uniqueFilename(prefix: string, ext = '.jpg'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}

// ─── DOWNLOAD FUNCTIONS PER SOURCE ──────────────────────────────────────────

// Employee avatars: realistic face photos from i.pravatar.cc
async function downloadEmployeeAvatar(imgId: number, folder: string): Promise<string> {
  const filename = uniqueFilename('employee');
  const destPath = path.join(UPLOADS_BASE, folder, filename);
  const url = `https://i.pravatar.cc/200?img=${imgId}`;
  await downloadFile(url, destPath);
  return `/api/uploads/${folder}/${filename}`;
}

// Business logo: stylized initials via ui-avatars.com
async function downloadLogo(businessName: string, bgColor: string, folder: string): Promise<string> {
  const filename = uniqueFilename('logo', '.png');
  const destPath = path.join(UPLOADS_BASE, folder, filename);
  const initials = businessName
    .split(/\s+/)
    .filter((w) => w.length > 2 || businessName.split(/\s+/).length <= 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const url = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=200&background=${bgColor}&color=ffffff&bold=true&font-size=0.4&format=png`;
  await downloadFile(url, destPath);
  return `/api/uploads/${folder}/${filename}`;
}

// Cover & gallery: relevant stock photos from loremflickr.com
async function downloadStockPhoto(
  keywords: string,
  width: number,
  height: number,
  folder: string,
  prefix: string,
): Promise<string> {
  const filename = uniqueFilename(prefix);
  const destPath = path.join(UPLOADS_BASE, folder, filename);
  // loremflickr uses comma-separated keywords + lock param for variety
  const lock = Math.random().toString(36).slice(2, 8);
  const url = `https://loremflickr.com/${width}/${height}/${keywords.replace(/\+/g, ',')}?lock=${lock}`;
  await downloadFile(url, destPath);
  return `/api/uploads/${folder}/${filename}`;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Downloading themed photos for marketplace businesses ===\n');
  console.log(`Uploads directory: ${UPLOADS_BASE}\n`);

  // Ensure folders exist
  for (const folder of ['avatars', 'portfolio']) {
    const dir = path.join(UPLOADS_BASE, folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  for (const [slug, config] of Object.entries(BUSINESS_PHOTOS)) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true, logoUrl: true, coverImageUrl: true },
    });

    if (!tenant) {
      console.log(`  x ${slug} — tenant not found, skipping`);
      continue;
    }

    console.log(`  ${tenant.name} (${slug}):`);

    try {
      // 1. Logo (initials with brand color)
      if (!tenant.logoUrl) {
        const logoUrl = await downloadLogo(tenant.name, config.logoColor, 'avatars');
        await prisma.tenant.update({ where: { id: tenant.id }, data: { logoUrl } });
        console.log(`    + Logo`);
        await delay(300);
      } else {
        console.log(`    - Logo already set`);
      }

      // 2. Cover (stock photo matching business type)
      if (!tenant.coverImageUrl) {
        const coverUrl = await downloadStockPhoto(config.coverKeywords, 800, 400, 'avatars', 'cover');
        await prisma.tenant.update({ where: { id: tenant.id }, data: { coverImageUrl: coverUrl } });
        console.log(`    + Cover (${config.coverKeywords})`);
        await delay(500);
      } else {
        console.log(`    - Cover already set`);
      }

      // 3. Gallery (stock photos matching services)
      const existingGallery = await prisma.tenantGalleryImage.count({
        where: { tenantId: tenant.id },
      });

      if (existingGallery === 0) {
        for (let i = 0; i < config.galleryKeywords.length; i++) {
          const imageUrl = await downloadStockPhoto(config.galleryKeywords[i], 600, 400, 'portfolio', 'gallery');
          await prisma.tenantGalleryImage.create({
            data: {
              tenantId: tenant.id,
              imageUrl,
              caption: config.galleryCaptions[i] || `Foto ${i + 1}`,
              sortOrder: i,
            },
          });
          await delay(500);
        }
        console.log(`    + ${config.galleryKeywords.length} gallery photos`);
      } else {
        console.log(`    - Gallery already has ${existingGallery} photos`);
      }

      // 4. Employee avatars (real face photos)
      const employees = await prisma.employee.findMany({
        where: { tenantId: tenant.id, isActive: true, avatarUrl: null },
        select: { id: true, firstName: true },
        orderBy: { createdAt: 'asc' },
      });

      let empCount = 0;
      for (let i = 0; i < employees.length && i < config.employeeAvatarIds.length; i++) {
        const avatarUrl = await downloadEmployeeAvatar(config.employeeAvatarIds[i], 'avatars');
        await prisma.employee.update({
          where: { id: employees[i].id },
          data: { avatarUrl },
        });
        empCount++;
        await delay(300);
      }
      if (empCount > 0) {
        console.log(`    + ${empCount} employee avatars (faces)`);
      }

    } catch (err: any) {
      console.log(`    x Error: ${err.message}`);
    }

    console.log('');
  }

  console.log('=== Done! ===');
  console.log('\nResumen:');
  console.log('  - Logos: iniciales estilizadas con color de marca (ui-avatars.com)');
  console.log('  - Covers: fotos de stock por tipo de negocio (loremflickr.com)');
  console.log('  - Galeria: fotos tematicas de servicios (loremflickr.com)');
  console.log('  - Empleados: fotos reales de personas (i.pravatar.cc)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
