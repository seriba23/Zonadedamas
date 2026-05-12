/**
 * seed-demo.ts
 *
 * Genera datos demo realistas y abundantes en el tenant existente "Demo Salon"
 * (admin@siliba.com / slug "demo-salon"). Idempotente: detecta registros
 * existentes y los salta. Diseñado para llegar a 10+ filas por tabla relevante.
 *
 * Uso:
 *   npx ts-node prisma/seed-demo.ts
 *   o desde apps/api: npm run db:seed-demo
 *
 * Pre-requisito: el seed principal (seed.ts) debe haberse corrido antes para
 * crear el tenant Demo Salon, location, permisos y roles.
 */

import {
  PrismaClient,
  Prisma,
  AppointmentStatus,
  PaymentMethod,
  PaymentStatus,
  AppointmentSource,
  DayOfWeek,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const prisma = new PrismaClient();
const UPLOADS_BASE = path.resolve(__dirname, '..', '..', '..', 'uploads');

// ─── DOWNLOAD HELPER ───────────────────────────────────────────────────────

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
      const req = client.get(reqUrl, (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          let redirectUrl = response.headers.location;
          if (redirectUrl.startsWith('/')) {
            const parsed = new URL(reqUrl);
            redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
          }
          response.resume();
          makeRequest(redirectUrl, redirectCount + 1);
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      });
      req.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
      req.setTimeout(15000, () => {
        req.destroy(new Error('Request timeout'));
      });
    };
    makeRequest(url);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function tryDownload(url: string, destAbs: string): Promise<string | null> {
  try {
    await downloadFile(url, destAbs);
    return destAbs;
  } catch (err) {
    console.log(`    ! Falló descarga ${url}: ${(err as Error).message}`);
    return null;
  }
}

// ─── DATOS BASE ────────────────────────────────────────────────────────────

const WORK_DAYS: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

const TEAL_PALETTE = [
  '#008080',
  '#0d9488',
  '#0f766e',
  '#14b8a6',
  '#7c3aed',
  '#9333ea',
  '#a855f7',
  '#db2777',
  '#ec4899',
  '#f43f5e',
];

const EXTRA_EMPLOYEES: Array<{
  firstName: string;
  lastName: string;
  bio: string;
  jobTitle: string;
}> = [
  {
    firstName: 'Valentina',
    lastName: 'Ramírez',
    jobTitle: 'Estilista Senior',
    bio: 'Especialista en colorimetría y técnicas modernas como balayage y babylights. Más de 8 años creando looks únicos.',
  },
  {
    firstName: 'Andrea',
    lastName: 'López',
    jobTitle: 'Manicurista',
    bio: 'Apasionada del nail art. Domina el gel, acrílico y diseños personalizados para cada ocasión.',
  },
  {
    firstName: 'Camila',
    lastName: 'Torres',
    jobTitle: 'Esteticista',
    bio: 'Certificada en limpiezas profundas, peelings y radiofrecuencia. Cuida la piel de sus clientes como propia.',
  },
  {
    firstName: 'Diego',
    lastName: 'Hernández',
    jobTitle: 'Barbero',
    bio: 'Maestro del fade y la barba clásica. Atiende con precisión y estilo desde hace 6 años.',
  },
  {
    firstName: 'Lucía',
    lastName: 'Vega',
    jobTitle: 'Terapeuta de Masajes',
    bio: 'Masoterapeuta diplomada en técnicas suecas, descontracturantes y piedras calientes.',
  },
  {
    firstName: 'Mateo',
    lastName: 'Rojas',
    jobTitle: 'Colorista',
    bio: 'Experto en transformaciones de color. Su mantra: el cabello sano siempre primero.',
  },
  {
    firstName: 'Renata',
    lastName: 'Castillo',
    jobTitle: 'Lash Stylist',
    bio: 'Pestañas pelo a pelo, lifting y tintes. Amante del detalle y la mirada perfecta.',
  },
  {
    firstName: 'Paula',
    lastName: 'Mendoza',
    jobTitle: 'Estilista',
    bio: 'Cortes femeninos modernos y peinados de gala. Te asesora con sinceridad.',
  },
  {
    firstName: 'Esteban',
    lastName: 'Navarro',
    jobTitle: 'Barbero Senior',
    bio: 'Barbería clásica con toques modernos. Cliente que entra estresado, sale como nuevo.',
  },
  {
    firstName: 'Isabela',
    lastName: 'Cordero',
    jobTitle: 'Depiladora',
    bio: 'Cera tibia y caliente con técnica indolora. Resultados duraderos.',
  },
];

const CLIENT_DATA: Array<{
  firstName: string;
  lastName: string;
  gender?: string;
}> = [
  { firstName: 'María', lastName: 'González', gender: 'FEMALE' },
  { firstName: 'Carlos', lastName: 'Sánchez', gender: 'MALE' },
  { firstName: 'Laura', lastName: 'Pérez', gender: 'FEMALE' },
  { firstName: 'Jorge', lastName: 'Ramírez', gender: 'MALE' },
  { firstName: 'Patricia', lastName: 'Jiménez', gender: 'FEMALE' },
  { firstName: 'Ricardo', lastName: 'Vargas', gender: 'MALE' },
  { firstName: 'Adriana', lastName: 'Castro', gender: 'FEMALE' },
  { firstName: 'Fernando', lastName: 'Ortiz', gender: 'MALE' },
  { firstName: 'Daniela', lastName: 'Morales', gender: 'FEMALE' },
  { firstName: 'Roberto', lastName: 'Aguilar', gender: 'MALE' },
  { firstName: 'Gabriela', lastName: 'Reyes', gender: 'FEMALE' },
  { firstName: 'Héctor', lastName: 'Mendoza', gender: 'MALE' },
  { firstName: 'Verónica', lastName: 'Salazar', gender: 'FEMALE' },
  { firstName: 'Alejandro', lastName: 'Gómez', gender: 'MALE' },
  { firstName: 'Mónica', lastName: 'Cruz', gender: 'FEMALE' },
];

const SERVICES_CATALOG: Array<{
  name: string;
  durationMinutes: number;
  price: number;
  category: string;
  subcategory?: string;
  color: string;
  description: string;
}> = [
  { name: 'Manicure Clásica', durationMinutes: 45, price: 25, category: 'Uñas', subcategory: 'Manicure', color: '#ec4899', description: 'Limado, cutícula y esmaltado tradicional.' },
  { name: 'Pedicure Spa', durationMinutes: 60, price: 35, category: 'Uñas', subcategory: 'Pedicure', color: '#db2777', description: 'Pedicure completa con baño de parafina y masaje relajante.' },
  { name: 'Tinte de Cabello', durationMinutes: 90, price: 75, category: 'Cabello', subcategory: 'Color', color: '#7c3aed', description: 'Tinte completo con productos profesionales.' },
  { name: 'Corte y Peinado', durationMinutes: 60, price: 45, category: 'Cabello', subcategory: 'Corte', color: '#0d9488', description: 'Corte personalizado más peinado de salida.' },
  { name: 'Masaje Relajante', durationMinutes: 60, price: 65, category: 'Spa', subcategory: 'Masaje', color: '#14b8a6', description: 'Masaje de cuerpo completo con aceites esenciales.' },
  { name: 'Limpieza Facial Profunda', durationMinutes: 75, price: 80, category: 'Facial', subcategory: 'Limpieza', color: '#008080', description: 'Limpieza con vapor, extracción y mascarilla.' },
  { name: 'Depilación con Cera', durationMinutes: 45, price: 40, category: 'Depilación', subcategory: 'Cera', color: '#f43f5e', description: 'Depilación de piernas completas o zonas a elegir.' },
  { name: 'Balayage Premium', durationMinutes: 120, price: 150, category: 'Cabello', subcategory: 'Color', color: '#a855f7', description: 'Técnica de iluminación a mano alzada.' },
  { name: 'Manicure Gel', durationMinutes: 60, price: 40, category: 'Uñas', subcategory: 'Manicure', color: '#ec4899', description: 'Manicure con esmalte semipermanente de larga duración.' },
  { name: 'Extensiones de Pestañas', durationMinutes: 90, price: 95, category: 'Pestañas', subcategory: 'Extensiones', color: '#9333ea', description: 'Aplicación pelo a pelo con resultado natural.' },
  { name: 'Maquillaje Social', durationMinutes: 60, price: 55, category: 'Maquillaje', subcategory: 'Social', color: '#db2777', description: 'Maquillaje profesional para eventos y fiestas.' },
  { name: 'Tratamiento Capilar', durationMinutes: 45, price: 50, category: 'Cabello', subcategory: 'Tratamiento', color: '#0f766e', description: 'Hidratación profunda y reparación.' },
];

const PRODUCTS_CATALOG: Array<{
  name: string;
  brand: string;
  description: string;
  price: number;
  stock: number;
  category: string;
}> = [
  { name: 'Shampoo Profesional Hidratante 500ml', brand: 'L\'Oréal Pro', description: 'Shampoo para cabellos secos y dañados.', price: 28, stock: 25, category: 'Cabello' },
  { name: 'Acondicionador Nutritivo 500ml', brand: 'L\'Oréal Pro', description: 'Acondicionador reparador con keratina.', price: 30, stock: 22, category: 'Cabello' },
  { name: 'Tinte Permanente Castaño Oscuro', brand: 'Wella Koleston', description: 'Tinte profesional larga duración.', price: 18, stock: 40, category: 'Color' },
  { name: 'Esmalte Semipermanente Rojo Pasión', brand: 'OPI Gel Color', description: 'Esmalte gel 15ml.', price: 22, stock: 30, category: 'Uñas' },
  { name: 'Crema Hidratante Facial 50ml', brand: 'CeraVe', description: 'Crema con ácido hialurónico.', price: 35, stock: 18, category: 'Facial' },
  { name: 'Mascarilla Facial Detox', brand: 'The Ordinary', description: 'Mascarilla limpieza profunda 30ml.', price: 25, stock: 15, category: 'Facial' },
  { name: 'Aceite de Argán Puro 100ml', brand: 'Moroccanoil', description: 'Aceite reparador para puntas.', price: 45, stock: 12, category: 'Cabello' },
  { name: 'Cera Depilatoria Profesional 500g', brand: 'Depilflax', description: 'Cera tibia rosa para piel sensible.', price: 20, stock: 35, category: 'Depilación' },
  { name: 'Removedor de Esmalte sin Acetona', brand: 'Sally Hansen', description: 'Removedor suave 120ml.', price: 12, stock: 50, category: 'Uñas' },
  { name: 'Plancha Profesional Titanio', brand: 'GHD', description: 'Plancha de cabello profesional.', price: 75, stock: 8, category: 'Herramientas' },
  { name: 'Set Pinceles Maquillaje 12 piezas', brand: 'Real Techniques', description: 'Pinceles profesionales para rostro y ojos.', price: 38, stock: 14, category: 'Maquillaje' },
  { name: 'Spray Fijador para Peinados 250ml', brand: 'Schwarzkopf', description: 'Spray fijador de larga duración.', price: 16, stock: 28, category: 'Cabello' },
];

const SUPPLIERS_CATALOG: Array<{
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}> = [
  { name: 'Distribuidora Bella Imagen S.A.', contactName: 'Roberto Núñez', email: 'ventas@bellaimagen.com', phone: '+52-33-1100-2200', address: 'Av. Vallarta 1234, Guadalajara', notes: 'Proveedor principal de productos de cabello.' },
  { name: 'Cosmética Profesional MX', contactName: 'Lorena Díaz', email: 'pedidos@cosmeticamx.com', phone: '+52-33-1100-2201', address: 'Calle Industria 45, Zapopan', notes: 'Marca propia y distribución de OPI.' },
  { name: 'Insumos Spa Total', contactName: 'Antonio Reyes', email: 'antonio@spatotal.com', phone: '+52-33-1100-2202', address: 'Periférico Sur 5567', notes: 'Aceites esenciales y productos de masaje.' },
  { name: 'Wella Distribuidor Oficial', contactName: 'Karla Mendoza', email: 'wella@distribuidor.com', phone: '+52-33-1100-2203', address: 'Av. Patria 880', notes: 'Tintes y químicos profesionales.' },
  { name: 'BeautySupply Pro', contactName: 'Manuel Castillo', email: 'pedidos@beautysupply.com', phone: '+52-33-1100-2204', address: 'Plaza Galerías local 23', notes: 'Maquillaje y accesorios.' },
  { name: 'Depilatorios y Más', contactName: 'Ana Lucía Torres', email: 'ventas@depilatorios.mx', phone: '+52-33-1100-2205', address: 'López Mateos Norte 990', notes: 'Ceras, bandas y postdepilatorios.' },
  { name: 'Herramientas del Estilista', contactName: 'Pedro Aguilar', email: 'info@herramientasestilista.com', phone: '+52-33-1100-2206', address: 'Av. Hidalgo 1230', notes: 'Planchas, secadoras, tijeras.' },
  { name: 'Nail Art Wholesale', contactName: 'Sofía Galván', email: 'sofia@nailwholesale.com', phone: '+52-33-1100-2207', address: 'Av. México 333', notes: 'Acrílicos, geles y decoración.' },
  { name: 'Importadora Dermo MX', contactName: 'Iván Pacheco', email: 'iván@dermo.mx', phone: '+52-33-1100-2208', address: 'Bosques de las Lomas 12', notes: 'Cosmética dermatológica importada.' },
  { name: 'Estética Premium Distribución', contactName: 'Claudia Romero', email: 'ventas@premium.mx', phone: '+52-33-1100-2209', address: 'Av. Chapultepec 4500', notes: 'Equipos y consumibles premium.' },
];

const PROMOTIONS_CATALOG: Array<{
  name: string;
  description: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'TWO_FOR_ONE';
  value: number;
  code: string;
  daysOffsetStart: number;
  daysOffsetEnd: number;
  isActive: boolean;
}> = [
  { name: 'Promo Bienvenida', description: 'Descuento en tu primera visita.', type: 'PERCENTAGE', value: 15, code: 'BIENVENIDA15', daysOffsetStart: -10, daysOffsetEnd: 60, isActive: true },
  { name: 'Verano Radiante', description: 'Descuento de verano en color y tratamientos.', type: 'PERCENTAGE', value: 25, code: 'VERANO25', daysOffsetStart: -5, daysOffsetEnd: 90, isActive: true },
  { name: 'Cupón Fijo $10', description: '$10 USD de descuento en cualquier servicio.', type: 'FIXED_AMOUNT', value: 10, code: 'AHORRA10', daysOffsetStart: -3, daysOffsetEnd: 45, isActive: true },
  { name: '2x1 Manicure', description: 'Lleva dos manicures al precio de una.', type: 'TWO_FOR_ONE', value: 0, code: 'MANI2X1', daysOffsetStart: -2, daysOffsetEnd: 30, isActive: true },
  { name: 'Lunes Glow', description: '10% off todos los lunes.', type: 'PERCENTAGE', value: 10, code: 'LUNES10', daysOffsetStart: -30, daysOffsetEnd: 90, isActive: true },
  { name: 'Promo Cumpleaños', description: '20% off el mes de tu cumpleaños.', type: 'PERCENTAGE', value: 20, code: 'BDAY20', daysOffsetStart: -15, daysOffsetEnd: 365, isActive: true },
  { name: 'Black Friday', description: 'Mega descuento de temporada (expirada).', type: 'PERCENTAGE', value: 30, code: 'BLACK30', daysOffsetStart: -120, daysOffsetEnd: -60, isActive: false },
  { name: 'Promo Día de la Madre', description: 'Regalo especial para mamá.', type: 'PERCENTAGE', value: 18, code: 'MAMA18', daysOffsetStart: 5, daysOffsetEnd: 25, isActive: true },
  { name: 'Combo Spa Pareja', description: '$25 off al reservar dos servicios spa.', type: 'FIXED_AMOUNT', value: 25, code: 'SPADUO', daysOffsetStart: -7, daysOffsetEnd: 60, isActive: true },
  { name: 'Pre-pasada Vacación', description: 'Promo expirada de referencia.', type: 'PERCENTAGE', value: 12, code: 'VACA12', daysOffsetStart: -100, daysOffsetEnd: -20, isActive: false },
];

const REVIEW_TEMPLATES: Array<{
  rating: number;
  comment: string;
  businessRating: number;
  businessComment: string;
}> = [
  { rating: 5, comment: 'Excelente atención, súper recomendado.', businessRating: 5, businessComment: 'El salón está impecable.' },
  { rating: 5, comment: 'Muy profesional, salí encantada con el resultado.', businessRating: 5, businessComment: 'Ambiente acogedor.' },
  { rating: 4, comment: 'Buen servicio, repetiré sin duda.', businessRating: 5, businessComment: 'Buena ubicación y limpieza.' },
  { rating: 5, comment: 'Manos mágicas, no cambio a mi estilista por nada.', businessRating: 4, businessComment: 'Hora de espera mínima.' },
  { rating: 5, comment: 'Atención personalizada y resultado impecable.', businessRating: 5, businessComment: 'Excelente trato del staff.' },
  { rating: 4, comment: 'Bonita experiencia, sólo el parking es complicado.', businessRating: 4, businessComment: 'Buen lugar en general.' },
  { rating: 5, comment: 'La mejor decisión, vuelvo mes a mes.', businessRating: 5, businessComment: 'Limpio y confortable.' },
  { rating: 5, comment: 'Súper recomendado, profesional y amable.', businessRating: 5, businessComment: 'Decoración preciosa.' },
  { rating: 4, comment: 'Resultado bueno, esperaba algo más, pero recomiendo.', businessRating: 4, businessComment: 'Espacio bonito y limpio.' },
  { rating: 5, comment: 'Salí sintiéndome increíble, mil gracias.', businessRating: 5, businessComment: 'Excelente atención general.' },
  { rating: 5, comment: 'Muy puntuales y excelente acabado.', businessRating: 5, businessComment: 'Recomendado al 100%.' },
  { rating: 5, comment: 'Volveré pronto, fue una experiencia memorable.', businessRating: 5, businessComment: 'Ambiente súper relajante.' },
  { rating: 4, comment: 'Buen servicio en general, calidad-precio.', businessRating: 4, businessComment: 'Cumplen lo que prometen.' },
  { rating: 5, comment: 'Detalle en cada paso, atención de lujo.', businessRating: 5, businessComment: 'Las instalaciones lucen muy nuevas.' },
  { rating: 5, comment: 'Recomendado totalmente, vale cada centavo.', businessRating: 5, businessComment: 'Comodidad y profesionalismo.' },
];

// ─── MAIN ─────────────────────────────────────────────────────────────────

interface CountersBag {
  employees: number;
  clients: number;
  services: number;
  products: number;
  suppliers: number;
  promotions: number;
  rewards: number;
  bundles: number;
  resources: number;
  appointments: number;
  payments: number;
  reviews: number;
  gallery: number;
  portfolio: number;
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('seed-demo.ts — datos demo extra para Demo Salon');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const counters: CountersBag = {
    employees: 0,
    clients: 0,
    services: 0,
    products: 0,
    suppliers: 0,
    promotions: 0,
    rewards: 0,
    bundles: 0,
    resources: 0,
    appointments: 0,
    payments: 0,
    reviews: 0,
    gallery: 0,
    portfolio: 0,
  };

  // 1. Buscar el tenant Demo Salon
  console.log('[1/16] Buscando tenant Demo Salon...');
  let tenant = await prisma.tenant.findUnique({ where: { slug: 'demo-salon' } });
  if (!tenant) {
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@siliba.com' },
      include: { tenant: true },
    });
    if (adminUser?.tenant) tenant = adminUser.tenant;
  }
  if (!tenant) {
    console.error(
      '\n✗ No se encontró el tenant Demo Salon. Corre primero `npm run db:seed` para crearlo.',
    );
    process.exit(1);
  }
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Location activa principal
  console.log('[2/16] Buscando location activa principal...');
  const location = await prisma.location.findFirst({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!location) {
    console.error('\n✗ No hay location activa para el tenant. Corre primero `npm run db:seed`.');
    process.exit(1);
  }
  console.log(`  ✓ Location: ${location.name} (${location.id})`);

  // 3. Empleados existentes
  console.log('[3/16] Verificando empleados existentes...');
  let existingEmployees = await prisma.employee.findMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  → ${existingEmployees.length} empleados ya existen.`);

  // 4. Servicios existentes
  console.log('[4/16] Verificando servicios existentes...');
  let existingServices = await prisma.service.findMany({
    where: { tenantId: tenant.id },
  });
  console.log(`  → ${existingServices.length} servicios ya existen.`);

  // ─── CREAR SERVICIOS HASTA TENER 10+ ─────────────────────────────────
  console.log('[5/16] Asegurando 10+ servicios...');
  const existingServiceNames = new Set(existingServices.map((s) => s.name.toLowerCase()));
  for (const svc of SERVICES_CATALOG) {
    if (existingServices.length >= 12) break;
    if (existingServiceNames.has(svc.name.toLowerCase())) {
      console.log(`  → saltando servicio "${svc.name}" (ya existe)`);
      continue;
    }
    const created = await prisma.service.create({
      data: {
        tenantId: tenant.id,
        name: svc.name,
        description: svc.description,
        durationMinutes: svc.durationMinutes,
        price: new Prisma.Decimal(svc.price),
        currency: 'USD',
        color: svc.color,
        category: svc.category,
        subcategory: svc.subcategory,
        isActive: true,
      },
    });
    existingServices.push(created);
    existingServiceNames.add(svc.name.toLowerCase());
    counters.services++;
    console.log(`  ✓ servicio "${svc.name}"`);
  }
  console.log(`  ✓ ${counters.services} servicios nuevos. Total: ${existingServices.length}`);

  // ─── CREAR EMPLEADOS HASTA TENER 10+ ────────────────────────────────
  console.log('[6/16] Asegurando 10+ empleados...');
  const targetEmployeeCount = 10;
  const existingEmpEmails = new Set(
    existingEmployees.map((e) => (e.email || '').toLowerCase()).filter(Boolean),
  );

  for (let i = 0; i < EXTRA_EMPLOYEES.length; i++) {
    if (existingEmployees.length >= targetEmployeeCount) break;
    const tmpl = EXTRA_EMPLOYEES[i];
    const email = `empleado${i + 1}@demosalon.com`;
    if (existingEmpEmails.has(email)) {
      console.log(`  → saltando empleado ${email} (ya existe)`);
      continue;
    }

    const color = TEAL_PALETTE[i % TEAL_PALETTE.length];

    // Descargar avatar
    const avatarFilename = `demo-emp-${i + 1}.jpg`;
    const avatarPath = path.join(UPLOADS_BASE, 'avatars', avatarFilename);
    let avatarUrl: string | null = null;
    if (!fs.existsSync(avatarPath)) {
      const ok = await tryDownload(
        `https://i.pravatar.cc/300?u=demo-employee-${i + 1}`,
        avatarPath,
      );
      if (ok) avatarUrl = `/api/uploads/avatars/${avatarFilename}`;
      await delay(120);
    } else {
      avatarUrl = `/api/uploads/avatars/${avatarFilename}`;
    }

    const phoneSuffix = String(2000 + i).padStart(4, '0');
    const created = await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        locationId: location.id,
        firstName: tmpl.firstName,
        lastName: tmpl.lastName,
        email,
        phone: `+52-33-3300-${phoneSuffix}`,
        color,
        bio: tmpl.bio,
        jobTitle: tmpl.jobTitle,
        avatarUrl: avatarUrl ?? undefined,
        isActive: true,
        sortOrder: existingEmployees.length,
      },
    });

    // Schedules Lun-Sáb 09:00-19:00, domingo cerrado
    const effectiveFrom = new Date();
    effectiveFrom.setMonth(effectiveFrom.getMonth() - 6);
    for (const day of WORK_DAYS) {
      await prisma.employeeSchedule.create({
        data: {
          employeeId: created.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '19:00',
          isWorking: true,
          effectiveFrom,
        },
      });
    }
    await prisma.employeeSchedule.create({
      data: {
        employeeId: created.id,
        dayOfWeek: 'SUNDAY' as DayOfWeek,
        startTime: '09:00',
        endTime: '19:00',
        isWorking: false,
        effectiveFrom,
      },
    });

    // Asignar 3-5 servicios aleatorios
    const shuffledSvcs = [...existingServices].sort(() => Math.random() - 0.5);
    const svcsToAssign = shuffledSvcs.slice(0, 3 + Math.floor(Math.random() * 3));
    for (const s of svcsToAssign) {
      await prisma.employeeService.upsert({
        where: {
          employeeId_serviceId: { employeeId: created.id, serviceId: s.id },
        },
        update: {},
        create: {
          employeeId: created.id,
          serviceId: s.id,
          commission: new Prisma.Decimal(15 + Math.floor(Math.random() * 20)),
        },
      });
    }

    existingEmployees.push(created);
    existingEmpEmails.add(email);
    counters.employees++;
    console.log(`  ✓ empleado "${tmpl.firstName} ${tmpl.lastName}"`);
  }
  console.log(`  ✓ ${counters.employees} empleados nuevos. Total: ${existingEmployees.length}`);

  // ─── CREAR 15 CLIENTES NUEVOS ────────────────────────────────────────
  console.log('[7/16] Creando 15 clientes demo...');
  const allClients = await prisma.client.findMany({ where: { tenantId: tenant.id } });
  const existingClientEmails = new Set(
    allClients.map((c) => (c.email || '').toLowerCase()).filter(Boolean),
  );

  for (let i = 0; i < CLIENT_DATA.length; i++) {
    const c = CLIENT_DATA[i];
    const email = `cliente.demo${i + 1}@example.com`;
    if (existingClientEmails.has(email)) {
      console.log(`  → saltando cliente ${email} (ya existe)`);
      continue;
    }

    const phoneA = String(1000 + Math.floor(Math.random() * 8999)).padStart(4, '0');
    const phoneB = String(1000 + Math.floor(Math.random() * 8999)).padStart(4, '0');

    // Avatar
    const avatarFilename = `demo-cli-${i + 1}.jpg`;
    const avatarPath = path.join(UPLOADS_BASE, 'avatars', avatarFilename);
    let avatarUrl: string | null = null;
    if (!fs.existsSync(avatarPath)) {
      const ok = await tryDownload(
        `https://i.pravatar.cc/300?u=demo-client-${i + 1}`,
        avatarPath,
      );
      if (ok) avatarUrl = `/api/uploads/avatars/${avatarFilename}`;
      await delay(120);
    } else {
      avatarUrl = `/api/uploads/avatars/${avatarFilename}`;
    }

    const created = await prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email,
        phone: `+52-33-${phoneA}-${phoneB}`,
        gender: c.gender,
        avatarUrl: avatarUrl ?? undefined,
        isActive: true,
        source: 'MANUAL',
        loyaltyPoints: Math.floor(Math.random() * 500),
      },
    });
    allClients.push(created);
    existingClientEmails.add(email);
    counters.clients++;
  }
  console.log(`  ✓ ${counters.clients} clientes creados. Total: ${allClients.length}`);

  // ─── PROVEEDORES ───────────────────────────────────────────────────
  console.log('[8/16] Creando suppliers...');
  const existingSuppliers = await prisma.supplier.findMany({ where: { tenantId: tenant.id } });
  const existingSupplierNames = new Set(existingSuppliers.map((s) => s.name.toLowerCase()));
  const suppliers = [...existingSuppliers];

  for (const sup of SUPPLIERS_CATALOG) {
    if (existingSupplierNames.has(sup.name.toLowerCase())) {
      console.log(`  → saltando supplier "${sup.name}" (ya existe)`);
      continue;
    }
    const created = await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: sup.name,
        contactName: sup.contactName,
        email: sup.email,
        phone: sup.phone,
        address: sup.address,
        notes: sup.notes,
        isActive: true,
      },
    });
    suppliers.push(created);
    existingSupplierNames.add(sup.name.toLowerCase());
    counters.suppliers++;
  }
  console.log(`  ✓ ${counters.suppliers} suppliers creados. Total: ${suppliers.length}`);

  // ─── PRODUCTOS ─────────────────────────────────────────────────────
  console.log('[9/16] Creando productos...');
  const existingProducts = await prisma.product.findMany({ where: { tenantId: tenant.id } });
  const existingProductNames = new Set(existingProducts.map((p) => p.name.toLowerCase()));

  for (let i = 0; i < PRODUCTS_CATALOG.length; i++) {
    const p = PRODUCTS_CATALOG[i];
    if (existingProductNames.has(p.name.toLowerCase())) {
      console.log(`  → saltando producto "${p.name}" (ya existe)`);
      continue;
    }

    // Descargar imagen
    const imgFilename = `demo-prod-${i + 1}.jpg`;
    const imgPath = path.join(UPLOADS_BASE, 'products', imgFilename);
    let imageUrl: string | null = null;
    if (!fs.existsSync(imgPath)) {
      const ok = await tryDownload(`https://picsum.photos/seed/product${i + 1}/400`, imgPath);
      if (ok) imageUrl = `/api/uploads/products/${imgFilename}`;
      await delay(120);
    } else {
      imageUrl = `/api/uploads/products/${imgFilename}`;
    }

    const supplier = suppliers.length > 0 ? suppliers[i % suppliers.length] : null;

    await prisma.product.create({
      data: {
        tenantId: tenant.id,
        name: p.name,
        description: `${p.brand} — ${p.description}`,
        category: p.category,
        price: new Prisma.Decimal(p.price),
        costPrice: new Prisma.Decimal(p.price * 0.6),
        stock: p.stock,
        minStock: 3,
        unit: 'unidad',
        supplierId: supplier?.id ?? null,
        currency: 'MXN',
        imageUrl: imageUrl ?? undefined,
        isActive: true,
        sku: `SKU-${1000 + i}`,
      },
    });
    counters.products++;
    existingProductNames.add(p.name.toLowerCase());
  }
  console.log(`  ✓ ${counters.products} productos creados.`);

  // ─── PROMOCIONES ───────────────────────────────────────────────────
  console.log('[10/16] Creando promociones...');
  const existingPromos = await prisma.promotion.findMany({ where: { tenantId: tenant.id } });
  const existingPromoCodes = new Set(
    existingPromos.map((p) => (p.code || '').toUpperCase()).filter(Boolean),
  );

  const now = new Date();
  for (const promo of PROMOTIONS_CATALOG) {
    if (existingPromoCodes.has(promo.code.toUpperCase())) {
      console.log(`  → saltando promoción ${promo.code} (ya existe)`);
      continue;
    }
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + promo.daysOffsetStart);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + promo.daysOffsetEnd);

    await prisma.promotion.create({
      data: {
        tenantId: tenant.id,
        name: promo.name,
        description: promo.description,
        type: promo.type,
        value: new Prisma.Decimal(promo.value),
        code: promo.code,
        startDate,
        endDate,
        maxUses: 100,
        usedCount: Math.floor(Math.random() * 15),
        isActive: promo.isActive,
      },
    });
    counters.promotions++;
    existingPromoCodes.add(promo.code.toUpperCase());
  }
  console.log(`  ✓ ${counters.promotions} promociones creadas.`);

  // ─── REWARDS ───────────────────────────────────────────────────────
  console.log('[11/16] Creando rewards (cupones de fidelidad)...');
  const existingRewardsArr = await prisma.reward.findMany({ where: { tenantId: tenant.id } });
  const existingRewardNames = new Set(existingRewardsArr.map((r) => r.name.toLowerCase()));

  const rewardsTemplates: Array<{
    name: string;
    description: string;
    type: 'SERVICIO' | 'DESCUENTO';
    pointsRequired: number;
    discountAmount?: number;
    discountMode?: 'FLAT' | 'PERCENTAGE';
    needsService?: boolean;
    isActive: boolean;
  }> = [
    { name: 'Manicure Gratis', description: 'Canjea por una manicure clásica.', type: 'SERVICIO', pointsRequired: 300, needsService: true, isActive: true },
    { name: 'Corte Gratis Demo', description: 'Canjea por un corte de cabello.', type: 'SERVICIO', pointsRequired: 400, needsService: true, isActive: true },
    { name: 'Masaje Sorpresa', description: 'Sesión de masaje relajante incluida.', type: 'SERVICIO', pointsRequired: 500, needsService: true, isActive: true },
    { name: 'Facial Gratis', description: 'Limpieza facial profunda.', type: 'SERVICIO', pointsRequired: 450, needsService: true, isActive: true },
    { name: '15% Descuento', description: '15% off en cualquier servicio.', type: 'DESCUENTO', pointsRequired: 200, discountAmount: 15, discountMode: 'PERCENTAGE', isActive: true },
    { name: '20% Descuento', description: '20% off en color.', type: 'DESCUENTO', pointsRequired: 350, discountAmount: 20, discountMode: 'PERCENTAGE', isActive: true },
    { name: '$5 USD Off', description: 'Cupón fijo de $5 USD.', type: 'DESCUENTO', pointsRequired: 100, discountAmount: 5, discountMode: 'FLAT', isActive: true },
    { name: '25% Descuento Premium', description: '25% off en servicios premium.', type: 'DESCUENTO', pointsRequired: 500, discountAmount: 25, discountMode: 'PERCENTAGE', isActive: true },
    { name: 'Reward Inactivo Demo', description: 'Reward expirado/inactivo de prueba.', type: 'DESCUENTO', pointsRequired: 50, discountAmount: 5, discountMode: 'PERCENTAGE', isActive: false },
    { name: 'Pedicure Spa Gratis', description: 'Disfruta una pedicure spa.', type: 'SERVICIO', pointsRequired: 380, needsService: true, isActive: true },
  ];

  for (const r of rewardsTemplates) {
    if (existingRewardNames.has(r.name.toLowerCase())) {
      console.log(`  → saltando reward "${r.name}" (ya existe)`);
      continue;
    }
    const refService = r.needsService
      ? existingServices[Math.floor(Math.random() * existingServices.length)]
      : null;

    await prisma.reward.create({
      data: {
        tenantId: tenant.id,
        name: r.name,
        description: r.description,
        type: r.type,
        pointsRequired: r.pointsRequired,
        serviceId: refService?.id ?? null,
        discountAmount: r.discountAmount ? new Prisma.Decimal(r.discountAmount) : null,
        discountMode: r.discountMode ?? null,
        isActive: r.isActive,
      },
    });
    counters.rewards++;
    existingRewardNames.add(r.name.toLowerCase());
  }
  console.log(`  ✓ ${counters.rewards} rewards creados.`);

  // ─── SERVICE BUNDLES ──────────────────────────────────────────────
  console.log('[12/16] Creando service bundles...');
  const existingBundles = await prisma.serviceBundle.findMany({ where: { tenantId: tenant.id } });
  const existingBundleNames = new Set(existingBundles.map((b) => b.name.toLowerCase()));

  const bundleTemplates = [
    { name: 'Pack Novia Total', desc: 'Maquillaje, peinado y manicure para tu gran día.', svcCount: 3, discount: 0.2 },
    { name: 'Spa Day Completo', desc: 'Masaje, facial y pedicure en una sola visita.', svcCount: 3, discount: 0.18 },
    { name: 'Look Mensual', desc: 'Corte y tratamiento capilar combinados.', svcCount: 2, discount: 0.15 },
    { name: 'Combo Uñas Premium', desc: 'Manicure y pedicure en gel.', svcCount: 2, discount: 0.15 },
    { name: 'Renovación Capilar', desc: 'Tinte, corte y tratamiento.', svcCount: 3, discount: 0.22 },
    { name: 'Glow Facial', desc: 'Limpieza facial y depilación.', svcCount: 2, discount: 0.12 },
    { name: 'Sesión Relax', desc: 'Masaje y facial.', svcCount: 2, discount: 0.16 },
    { name: 'Look Express', desc: 'Corte y peinado rápido.', svcCount: 2, discount: 0.1 },
    { name: 'Belleza Total', desc: 'Trío imbatible: uñas, cabello y facial.', svcCount: 3, discount: 0.25 },
    { name: 'Día de Madre', desc: 'Mimar a mamá con manicure y masaje.', svcCount: 2, discount: 0.15 },
  ];

  for (const b of bundleTemplates) {
    if (existingBundleNames.has(b.name.toLowerCase())) {
      console.log(`  → saltando bundle "${b.name}" (ya existe)`);
      continue;
    }
    const shuffled = [...existingServices].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, b.svcCount);
    if (chosen.length < 2) continue;

    const totalPrice = chosen.reduce((sum, s) => sum + Number(s.price), 0);
    const totalDuration = chosen.reduce((sum, s) => sum + s.durationMinutes, 0);
    const bundlePrice = totalPrice * (1 - b.discount);

    await prisma.serviceBundle.create({
      data: {
        tenantId: tenant.id,
        name: b.name,
        description: b.desc,
        bundlePrice: new Prisma.Decimal(bundlePrice.toFixed(2)),
        serviceIds: chosen.map((s) => s.id),
        totalDuration,
        savingsPercent: new Prisma.Decimal((b.discount * 100).toFixed(2)),
        isActive: true,
      },
    });
    counters.bundles++;
    existingBundleNames.add(b.name.toLowerCase());
  }
  console.log(`  ✓ ${counters.bundles} bundles creados.`);

  // ─── RESOURCES ────────────────────────────────────────────────────
  console.log('[13/16] Creando resources...');
  const existingResources = await prisma.resource.findMany({
    where: { tenantId: tenant.id, locationId: location.id },
  });
  const existingResourceNames = new Set(existingResources.map((r) => r.name.toLowerCase()));

  const resourceTemplates: Array<{ name: string; type: string; quantity: number }> = [
    { name: 'Silla de Corte 1', type: 'silla', quantity: 1 },
    { name: 'Silla de Corte 2', type: 'silla', quantity: 1 },
    { name: 'Silla de Corte 3', type: 'silla', quantity: 1 },
    { name: 'Silla de Corte 4', type: 'silla', quantity: 1 },
    { name: 'Silla de Corte 5', type: 'silla', quantity: 1 },
    { name: 'Lavabo 1', type: 'lavabo', quantity: 1 },
    { name: 'Lavabo 2', type: 'lavabo', quantity: 1 },
    { name: 'Cabina de Masaje 1', type: 'cabina', quantity: 1 },
    { name: 'Cabina de Masaje 2', type: 'cabina', quantity: 1 },
    { name: 'Cama de Pedicure 1', type: 'cama', quantity: 1 },
    { name: 'Cama de Pedicure 2', type: 'cama', quantity: 1 },
  ];
  for (const r of resourceTemplates) {
    if (existingResourceNames.has(r.name.toLowerCase())) {
      console.log(`  → saltando resource "${r.name}" (ya existe)`);
      continue;
    }
    await prisma.resource.create({
      data: {
        tenantId: tenant.id,
        locationId: location.id,
        name: r.name,
        type: r.type,
        quantity: r.quantity,
        condition: 'good',
        isActive: true,
      },
    });
    counters.resources++;
    existingResourceNames.add(r.name.toLowerCase());
  }
  console.log(`  ✓ ${counters.resources} resources creados.`);

  // ─── APPOINTMENTS ──────────────────────────────────────────────────
  console.log('[14/16] Creando 50 appointments distribuidos...');

  const allEmployeesFull = await prisma.employee.findMany({
    where: { tenantId: tenant.id, isActive: true },
    include: { employeeServices: { include: { service: true } } },
  });
  const employeesWithServices = allEmployeesFull.filter((e) => e.employeeServices.length > 0);

  const allClientsCurrent = await prisma.client.findMany({
    where: { tenantId: tenant.id, isActive: true },
  });

  if (employeesWithServices.length === 0 || allClientsCurrent.length === 0) {
    console.log('  ! No hay empleados con servicios o clientes; saltando appointments.');
  } else {
    // Limpieza retroactiva: vaciar el viejo marcador "[demo-seed] idx=N" que
    // se mostraba al usuario en las notas internas.
    const cleaned = await prisma.appointment.updateMany({
      where: { tenantId: tenant.id, internalNotes: { startsWith: '[demo-seed]' } },
      data: { internalNotes: null },
    });
    if (cleaned.count > 0) {
      console.log(`  ↻ ${cleaned.count} notas internas con marcador antiguo limpiadas.`);
    }

    // Idempotencia: si el tenant ya tiene >= 40 appointments, no creamos mas.
    const existingDemoApts = await prisma.appointment.count({
      where: { tenantId: tenant.id },
    });

    if (existingDemoApts >= 40) {
      console.log(`  → ${existingDemoApts} appointments ya existen; saltando creación.`);
    } else {
      // Distribución:
      // - 20 COMPLETED (últimos 60 días)
      // - 10 CONFIRMED (próximos 14 días)
      //  - 5 CANCELLED (pasado)
      //  - 5 NO_SHOW (pasado)
      // - 10 PENDING (próximos 7 días)
      type ApptPlan = { offsetDays: number; status: AppointmentStatus };
      const plans: ApptPlan[] = [];
      for (let i = 0; i < 20; i++) plans.push({ offsetDays: -1 - Math.floor(Math.random() * 60), status: 'COMPLETED' });
      for (let i = 0; i < 10; i++) plans.push({ offsetDays: 1 + Math.floor(Math.random() * 14), status: 'CONFIRMED' });
      for (let i = 0; i < 5; i++) plans.push({ offsetDays: -1 - Math.floor(Math.random() * 45), status: 'CANCELLED' });
      for (let i = 0; i < 5; i++) plans.push({ offsetDays: -1 - Math.floor(Math.random() * 45), status: 'NO_SHOW' });
      for (let i = 0; i < 10; i++) plans.push({ offsetDays: 1 + Math.floor(Math.random() * 7), status: 'PENDING' });

      // Garantizar horarios laborales (09-18) y no exactamente el mismo slot por empleado
      const slotsTakenByEmp = new Map<string, Set<string>>();

      const baseDate = new Date();
      baseDate.setHours(0, 0, 0, 0);

      let aptIdx = 0;
      for (const plan of plans) {
        const emp = employeesWithServices[aptIdx % employeesWithServices.length];
        const client = allClientsCurrent[aptIdx % allClientsCurrent.length];
        const empSvcs = emp.employeeServices;
        const primaryEmpSvc = empSvcs[aptIdx % empSvcs.length];
        const primarySvc = primaryEmpSvc.service;
        // 30% chance de tener 2 servicios
        const has2 = Math.random() < 0.3 && empSvcs.length > 1;
        const secondaryEmpSvc = has2 ? empSvcs[(aptIdx + 1) % empSvcs.length] : null;
        const secondarySvc = secondaryEmpSvc?.service ?? null;

        // Hora: 09, 10, 11, 12, 14, 15, 16, 17
        const hourPool = [9, 10, 11, 12, 14, 15, 16, 17];
        let attempt = 0;
        let chosenHour = hourPool[aptIdx % hourPool.length];
        let dayDate = new Date(baseDate);
        dayDate.setDate(dayDate.getDate() + plan.offsetDays);
        // Evitar domingo
        if (dayDate.getDay() === 0) dayDate.setDate(dayDate.getDate() + 1);

        // Buscar slot libre para este empleado
        const empSlotKey = (d: Date, h: number) =>
          `${d.toISOString().slice(0, 10)}#${h}`;
        let taken = slotsTakenByEmp.get(emp.id) || new Set<string>();
        while (taken.has(empSlotKey(dayDate, chosenHour)) && attempt < 12) {
          chosenHour = hourPool[(aptIdx + attempt + 1) % hourPool.length];
          if (attempt > 6) {
            dayDate.setDate(dayDate.getDate() + 1);
            if (dayDate.getDay() === 0) dayDate.setDate(dayDate.getDate() + 1);
          }
          attempt++;
        }
        taken.add(empSlotKey(dayDate, chosenHour));
        slotsTakenByEmp.set(emp.id, taken);

        const startTime = new Date(
          Date.UTC(
            dayDate.getFullYear(),
            dayDate.getMonth(),
            dayDate.getDate(),
            chosenHour,
            0,
            0,
          ),
        );
        const totalDuration =
          primarySvc.durationMinutes + (secondarySvc?.durationMinutes ?? 0);
        const endTime = new Date(startTime.getTime() + totalDuration * 60 * 1000);

        const apt = await prisma.appointment.create({
          data: {
            tenantId: tenant.id,
            locationId: emp.locationId,
            clientId: client.id,
            employeeId: emp.id,
            status: plan.status,
            startTime,
            endTime,
            internalNotes: null,
            notes:
              plan.status === 'PENDING'
                ? 'Cita por confirmar'
                : plan.status === 'CANCELLED'
                ? 'Cliente canceló por motivos personales'
                : plan.status === 'NO_SHOW'
                ? 'Cliente no se presentó'
                : null,
            cancellationReason:
              plan.status === 'CANCELLED' ? 'Cliente no podía asistir' : null,
            source: 'MANUAL' as AppointmentSource,
          },
        });
        counters.appointments++;

        await prisma.appointmentItem.create({
          data: {
            appointmentId: apt.id,
            serviceId: primarySvc.id,
            employeeId: emp.id,
            startTime,
            endTime: new Date(
              startTime.getTime() + primarySvc.durationMinutes * 60 * 1000,
            ),
            priceSnapshot: primarySvc.price,
            durationSnapshot: primarySvc.durationMinutes,
            serviceNameSnapshot: primarySvc.name,
            commissionSnapshot: primaryEmpSvc.commission ?? null,
          },
        });

        if (secondarySvc && secondaryEmpSvc) {
          const sStart = new Date(
            startTime.getTime() + primarySvc.durationMinutes * 60 * 1000,
          );
          await prisma.appointmentItem.create({
            data: {
              appointmentId: apt.id,
              serviceId: secondarySvc.id,
              employeeId: emp.id,
              startTime: sStart,
              endTime: new Date(
                sStart.getTime() + secondarySvc.durationMinutes * 60 * 1000,
              ),
              priceSnapshot: secondarySvc.price,
              durationSnapshot: secondarySvc.durationMinutes,
              serviceNameSnapshot: secondarySvc.name,
              commissionSnapshot: secondaryEmpSvc.commission ?? null,
            },
          });
        }

        await prisma.appointmentStatusHistory.create({
          data: {
            appointmentId: apt.id,
            fromStatus: null,
            toStatus: plan.status,
            notes: 'Creado por seed-demo',
          },
        });

        // Si COMPLETED → registrar Payment
        if (plan.status === 'COMPLETED') {
          const total =
            Number(primarySvc.price) + (secondarySvc ? Number(secondarySvc.price) : 0);
          const methods: PaymentMethod[] = ['CASH', 'CARD', 'STRIPE'];
          const method = methods[aptIdx % methods.length];

          await prisma.payment.create({
            data: {
              tenantId: tenant.id,
              appointmentId: apt.id,
              clientId: client.id,
              locationId: emp.locationId,
              amount: new Prisma.Decimal(total),
              totalAmount: new Prisma.Decimal(total),
              currency: 'USD',
              paymentMethod: method,
              status: 'COMPLETED' as PaymentStatus,
              items: {
                create: [
                  {
                    description: primarySvc.name,
                    quantity: 1,
                    unitPrice: primarySvc.price,
                    totalPrice: primarySvc.price,
                    itemType: 'SERVICE',
                    referenceId: primarySvc.id,
                    referenceType: 'service',
                  },
                  ...(secondarySvc
                    ? [
                        {
                          description: secondarySvc.name,
                          quantity: 1,
                          unitPrice: secondarySvc.price,
                          totalPrice: secondarySvc.price,
                          itemType: 'SERVICE' as const,
                          referenceId: secondarySvc.id,
                          referenceType: 'service',
                        },
                      ]
                    : []),
                ],
              },
            },
          });
          counters.payments++;
        }

        aptIdx++;
      }
    }
  }
  console.log(
    `  ✓ ${counters.appointments} appointments + ${counters.payments} payments creados.`,
  );

  // ─── REVIEWS ───────────────────────────────────────────────────────
  console.log('[15/16] Creando reviews para citas completadas...');
  const completedDemoApts = await prisma.appointment.findMany({
    where: {
      tenantId: tenant.id,
      status: 'COMPLETED',
      review: null,
    },
    take: 15,
  });

  for (let i = 0; i < completedDemoApts.length; i++) {
    const apt = completedDemoApts[i];
    const tmpl = REVIEW_TEMPLATES[i % REVIEW_TEMPLATES.length];
    try {
      await prisma.employeeReview.create({
        data: {
          tenantId: tenant.id,
          employeeId: apt.employeeId,
          clientId: apt.clientId,
          appointmentId: apt.id,
          rating: tmpl.rating,
          comment: tmpl.comment,
          businessRating: tmpl.businessRating,
          businessComment: tmpl.businessComment,
          isVisible: true,
          reviewedAt: new Date(),
        },
      });
      counters.reviews++;
    } catch (err) {
      // Posible duplicado por appointmentId @unique — saltar
    }
  }
  console.log(`  ✓ ${counters.reviews} reviews creadas.`);

  // ─── GALLERY ───────────────────────────────────────────────────────
  console.log('[16/16] Creando galería del tenant y portfolios de empleados...');
  const existingGallery = await prisma.tenantGalleryImage.count({
    where: { tenantId: tenant.id },
  });
  if (existingGallery < 8) {
    for (let i = 0; i < 8; i++) {
      const fname = `demo-gallery-${i + 1}.jpg`;
      const dest = path.join(UPLOADS_BASE, 'portfolio', fname);
      let url: string | null = null;
      if (!fs.existsSync(dest)) {
        const ok = await tryDownload(`https://picsum.photos/seed/gallery${i + 1}/600`, dest);
        if (ok) url = `/api/uploads/portfolio/${fname}`;
        await delay(120);
      } else {
        url = `/api/uploads/portfolio/${fname}`;
      }
      if (!url) continue;

      await prisma.tenantGalleryImage.create({
        data: {
          tenantId: tenant.id,
          imageUrl: url,
          caption: `Foto del salón ${i + 1}`,
          sortOrder: i,
        },
      });
      counters.gallery++;
    }
  } else {
    console.log(`  → galería ya tiene ${existingGallery} fotos, saltando.`);
  }

  // Portfolio: 3 fotos por cada uno de los primeros 5 empleados
  const first5Employees = (
    await prisma.employee.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { createdAt: 'asc' },
      take: 5,
    })
  );
  for (const emp of first5Employees) {
    const existingPort = await prisma.employeePortfolioImage.count({
      where: { employeeId: emp.id },
    });
    if (existingPort >= 3) {
      console.log(`  → portfolio de ${emp.firstName} ya tiene ${existingPort} fotos, saltando.`);
      continue;
    }
    const empShortId = emp.id.slice(0, 8);
    for (let i = 0; i < 3; i++) {
      const fname = `demo-portfolio-${empShortId}-${i + 1}.jpg`;
      const dest = path.join(UPLOADS_BASE, 'portfolio', fname);
      let url: string | null = null;
      if (!fs.existsSync(dest)) {
        const ok = await tryDownload(
          `https://picsum.photos/seed/portfolio-${empShortId}-${i}/500`,
          dest,
        );
        if (ok) url = `/api/uploads/portfolio/${fname}`;
        await delay(120);
      } else {
        url = `/api/uploads/portfolio/${fname}`;
      }
      if (!url) continue;

      await prisma.employeePortfolioImage.create({
        data: {
          employeeId: emp.id,
          imageUrl: url,
          caption: `Trabajo ${i + 1} de ${emp.firstName}`,
          sortOrder: i,
        },
      });
      counters.portfolio++;
    }
  }
  console.log(`  ✓ ${counters.gallery} fotos de galería + ${counters.portfolio} portfolios.`);

  // ─── RESUMEN ──────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  RESUMEN — REGISTROS CREADOS POR seed-demo.ts');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Empleados nuevos:   ${counters.employees}`);
  console.log(`  Clientes nuevos:    ${counters.clients}`);
  console.log(`  Servicios nuevos:   ${counters.services}`);
  console.log(`  Productos nuevos:   ${counters.products}`);
  console.log(`  Suppliers nuevos:   ${counters.suppliers}`);
  console.log(`  Promociones:        ${counters.promotions}`);
  console.log(`  Rewards:            ${counters.rewards}`);
  console.log(`  Bundles:            ${counters.bundles}`);
  console.log(`  Resources:          ${counters.resources}`);
  console.log(`  Appointments:       ${counters.appointments}`);
  console.log(`  Payments:           ${counters.payments}`);
  console.log(`  Reviews:            ${counters.reviews}`);
  console.log(`  Galería:            ${counters.gallery}`);
  console.log(`  Portfolio fotos:    ${counters.portfolio}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✓ seed-demo.ts completado correctamente.\n');
}

export default main;

main()
  .catch((e) => {
    console.error('\n✗ seed-demo falló:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
