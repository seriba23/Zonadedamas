/**
 * seed-fix-avatars.ts
 *
 * Detecta avatares "huérfanos" en BD (avatarUrl apunta a archivo inexistente)
 * y los reemplaza descargando uno nuevo de pravatar.cc.
 *
 * Aplica a:
 * - Employee.avatarUrl
 * - Employee.coverImageUrl (descarga de picsum)
 * - User.avatarUrl (clientes con cuenta)
 * - Client.avatarUrl (clientes sin cuenta)
 *
 * Idempotente: si el archivo ya existe, no hace nada.
 *
 * Uso: cd apps/api && npm run db:seed-fix-avatars
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

/** Convierte un avatarUrl tipo "/api/uploads/avatars/foo.jpg" a path fisico. */
function urlToPath(url: string): string | null {
  // Ej: /api/uploads/avatars/employee-X.jpg -> avatars/employee-X.jpg
  const m = url.match(/^\/api\/uploads\/(.+)$/);
  if (!m) return null;
  return path.join(UPLOADS_BASE, m[1]);
}

async function checkAndReplace(opts: {
  label: string;
  avatarUrl: string | null;
  seed: string; // p.ej. el id o nombre del registro
  folder: 'avatars' | 'portfolio';
  source: 'pravatar' | 'picsum';
}): Promise<{ newUrl: string | null; replaced: boolean }> {
  if (!opts.avatarUrl) return { newUrl: null, replaced: false };

  const filePath = urlToPath(opts.avatarUrl);
  if (filePath && fs.existsSync(filePath)) {
    return { newUrl: opts.avatarUrl, replaced: false };
  }

  // Descargar nuevo avatar
  const ext = opts.source === 'picsum' ? 'jpg' : 'jpg';
  const filename = `fixed-${opts.folder.slice(0, 3)}-${opts.seed.replace(/[^a-zA-Z0-9-]/g, '')}-${Date.now()}.${ext}`;
  const destAbs = path.join(UPLOADS_BASE, opts.folder, filename);
  const url = opts.source === 'pravatar'
    ? `https://i.pravatar.cc/300?u=${encodeURIComponent(opts.seed)}`
    : `https://picsum.photos/seed/${encodeURIComponent(opts.seed)}/800/400`;

  try {
    await downloadFile(url, destAbs);
    return { newUrl: `/api/uploads/${opts.folder}/${filename}`, replaced: true };
  } catch (err: any) {
    console.warn(`  ⚠️  fallo descarga (${opts.seed}): ${err.message}`);
    return { newUrl: null, replaced: false };
  }
}

async function main() {
  console.log('🖼️  Reparando avatares huérfanos en Demo Salon\n');

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'demo-salon' } });
  if (!tenant) {
    console.error('❌ Tenant "demo-salon" no encontrado.');
    process.exit(1);
  }
  console.log(`✓ Tenant: ${tenant.name}\n`);

  let fixedEmp = 0;
  let fixedCovers = 0;
  let fixedUsers = 0;
  let fixedClients = 0;

  // ─── Employees ───
  const employees = await prisma.employee.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true, coverImageUrl: true },
  });
  console.log(`📋 ${employees.length} empleados...`);
  for (const emp of employees) {
    const seedName = `${emp.firstName}-${emp.lastName}-${emp.id.slice(0, 8)}`;
    const r = await checkAndReplace({
      label: `Employee ${emp.firstName} ${emp.lastName}`,
      avatarUrl: emp.avatarUrl,
      seed: seedName,
      folder: 'avatars',
      source: 'pravatar',
    });
    if (r.replaced && r.newUrl) {
      await prisma.employee.update({ where: { id: emp.id }, data: { avatarUrl: r.newUrl } });
      console.log(`  ✓ Avatar reparado: ${emp.firstName} ${emp.lastName}`);
      fixedEmp++;
      await delay(100);
    }

    const c = await checkAndReplace({
      label: `Employee cover ${emp.firstName}`,
      avatarUrl: emp.coverImageUrl,
      seed: `cover-${seedName}`,
      folder: 'portfolio',
      source: 'picsum',
    });
    if (c.replaced && c.newUrl) {
      await prisma.employee.update({ where: { id: emp.id }, data: { coverImageUrl: c.newUrl } });
      console.log(`  ✓ Cover reparado: ${emp.firstName} ${emp.lastName}`);
      fixedCovers++;
      await delay(100);
    }
  }

  // ─── Users (clientes con cuenta marketplace) ───
  // Asociados al tenant son los que tienen tenantId. Para marketplace usuarios
  // (tenantId null) tambien revisamos por completitud.
  const users = await prisma.user.findMany({
    where: { avatarUrl: { not: null } },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });
  console.log(`\n📋 ${users.length} usuarios con avatar...`);
  for (const u of users) {
    const r = await checkAndReplace({
      label: `User ${u.firstName} ${u.lastName}`,
      avatarUrl: u.avatarUrl,
      seed: `user-${u.firstName}-${u.id.slice(0, 8)}`,
      folder: 'avatars',
      source: 'pravatar',
    });
    if (r.replaced && r.newUrl) {
      await prisma.user.update({ where: { id: u.id }, data: { avatarUrl: r.newUrl } });
      console.log(`  ✓ Avatar reparado: ${u.firstName} ${u.lastName}`);
      fixedUsers++;
      await delay(100);
    }
  }

  // ─── Clients (registros del tenant, sin necesariamente cuenta) ───
  const clients = await prisma.client.findMany({
    where: { tenantId: tenant.id, avatarUrl: { not: null } },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });
  console.log(`\n📋 ${clients.length} clientes con avatar...`);
  for (const c of clients) {
    const r = await checkAndReplace({
      label: `Client ${c.firstName} ${c.lastName}`,
      avatarUrl: c.avatarUrl,
      seed: `client-${c.firstName}-${c.id.slice(0, 8)}`,
      folder: 'avatars',
      source: 'pravatar',
    });
    if (r.replaced && r.newUrl) {
      await prisma.client.update({ where: { id: c.id }, data: { avatarUrl: r.newUrl } });
      console.log(`  ✓ Avatar reparado: ${c.firstName} ${c.lastName}`);
      fixedClients++;
      await delay(100);
    }
  }

  console.log('\n📊 Resumen:');
  console.log(`   Employees avatar: ${fixedEmp}`);
  console.log(`   Employees cover:  ${fixedCovers}`);
  console.log(`   Users:            ${fixedUsers}`);
  console.log(`   Clients:          ${fixedClients}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('💥 Error fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
