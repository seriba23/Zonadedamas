import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const prisma = new PrismaClient();
const UPLOADS_BASE = path.resolve(__dirname, '..', '..', '..', 'uploads');

// Cada negocio usa un seed único de picsum.photos para garantizar imágenes 100% distintas
// + keywords de loremflickr como fallback
const LOGOS: { slug: string; picsumSeed: number }[] = [
  { slug: 'bella-donna',     picsumSeed: 142 },
  { slug: 'barberkings',     picsumSeed: 366 },
  { slug: 'zen-spa',         picsumSeed: 509 },
  { slug: 'derma-plus',      picsumSeed: 633 },
  { slug: 'nails-factory',   picsumSeed: 755 },
  { slug: 'corta-y-calla',   picsumSeed: 823 },
  { slug: 'glow-beauty',     picsumSeed: 901 },
  { slug: 'thai-harmony',    picsumSeed: 1042 },
  { slug: 'clinica-renovar', picsumSeed: 1067 },
  { slug: 'rizos-and-co',    picsumSeed: 1080 },
];

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const file = fs.createWriteStream(destPath);

    const makeRequest = (reqUrl: string, redirects = 0) => {
      if (redirects > 10) { reject(new Error('Too many redirects')); return; }
      const client = reqUrl.startsWith('https') ? https : http;
      client.get(reqUrl, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let loc = res.headers.location;
          if (loc.startsWith('/')) { const u = new URL(reqUrl); loc = `${u.protocol}//${u.host}${loc}`; }
          makeRequest(loc, redirects + 1);
          return;
        }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
    };
    makeRequest(url);
  });
}

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log('=== Reemplazando logos con fotos reales ===\n');

  const dir = path.join(UPLOADS_BASE, 'avatars');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  for (const logo of LOGOS) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: logo.slug }, select: { id: true, name: true, logoUrl: true } });
    if (!tenant) { console.log(`  x ${logo.slug} no encontrado`); continue; }

    // Borrar logo viejo si existe
    if (tenant.logoUrl) {
      const oldFile = path.join(UPLOADS_BASE, tenant.logoUrl.replace('/api/uploads/', ''));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    const filename = `logo-${logo.slug}-${Date.now()}.jpg`;
    const destPath = path.join(dir, filename);
    // picsum.photos con seed único = imagen garantizada diferente por negocio
    const url = `https://picsum.photos/seed/${logo.picsumSeed}/200/200`;

    try {
      await downloadFile(url, destPath);
      const logoUrl = `/api/uploads/avatars/${filename}`;
      await prisma.tenant.update({ where: { id: tenant.id }, data: { logoUrl } });
      console.log(`  + ${tenant.name} (seed: ${logo.picsumSeed})`);
    } catch (err: any) {
      console.log(`  x ${tenant.name}: ${err.message}`);
    }

    await delay(300);
  }

  console.log('\n=== Listo! ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
