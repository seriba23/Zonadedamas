import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const WORK_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

// ─── 10 NEGOCIOS VARIADOS ──────────────────────────────────────────────────

const BUSINESSES = [
  {
    name: 'Bella Donna Salon',
    slug: 'bella-donna',
    email: 'info@belladonna.com',
    businessType: 'SALON',
    description: 'Salón de belleza integral especializado en corte, color y tratamientos capilares. Ambiente sofisticado y atención personalizada.',
    address: 'Calle Gran Vía 42, Madrid',
    phone: '+34-911-001-001',
    location: { name: 'Sede Principal', address: 'Calle Gran Vía 42, Madrid', lat: 40.4200, lng: -3.7025 },
    admin: { email: 'admin@belladonna.com', firstName: 'Laura', lastName: 'Fernández' },
    employees: [
      { firstName: 'Claudia', lastName: 'Ruiz', email: 'claudia@belladonna.com', color: '#e91e63', bio: 'Estilista senior, 12 años de experiencia en coloración' },
      { firstName: 'Andrea', lastName: 'López', email: 'andrea@belladonna.com', color: '#9c27b0', bio: 'Especialista en cortes modernos y tendencia' },
      { firstName: 'Daniela', lastName: 'Torres', email: 'daniela@belladonna.com', color: '#ff9800', bio: 'Experta en tratamientos capilares y keratina' },
    ],
    services: [
      { name: 'Corte Mujer', duration: 45, price: 35, color: '#e91e63', category: 'SALON', subcategory: 'Corte', points: 35 },
      { name: 'Tinte Global', duration: 120, price: 85, color: '#9c27b0', category: 'SALON', subcategory: 'Coloración', points: 85 },
      { name: 'Mechas Balayage', duration: 150, price: 120, color: '#ff5722', category: 'SALON', subcategory: 'Coloración', points: 120 },
      { name: 'Brushing', duration: 30, price: 20, color: '#ff9800', category: 'SALON', subcategory: 'Peinados y Styling', points: 20 },
      { name: 'Tratamiento Keratina', duration: 90, price: 95, color: '#4caf50', category: 'SALON', subcategory: 'Tratamientos', points: 95 },
      { name: 'Peinado Evento', duration: 60, price: 55, color: '#2196f3', category: 'SALON', subcategory: 'Peinados y Styling', points: 55 },
    ],
    hours: { open: '09:00', close: '20:00' },
  },
  {
    name: 'BarberKings',
    slug: 'barberkings',
    email: 'info@barberkings.com',
    businessType: 'BARBERIA',
    description: 'Barbería urbana con estilo clásico americano. Cerveza artesanal cortesía mientras esperas. Solo para caballeros.',
    address: 'Calle Fuencarral 78, Madrid',
    phone: '+34-911-002-002',
    location: { name: 'BarberKings Central', address: 'Calle Fuencarral 78, Madrid', lat: 40.4260, lng: -3.7010 },
    admin: { email: 'admin@barberkings.com', firstName: 'Carlos', lastName: 'Méndez' },
    employees: [
      { firstName: 'Javier', lastName: 'Ramos', email: 'javier@barberkings.com', color: '#1565c0', bio: 'Master barber, experto en fade y diseños' },
      { firstName: 'Diego', lastName: 'Herrera', email: 'diego@barberkings.com', color: '#2e7d32', bio: 'Especialista en barba y afeitado clásico' },
    ],
    services: [
      { name: 'Corte Caballero', duration: 30, price: 18, color: '#1565c0', category: 'BARBERIA', subcategory: 'Corte', points: 18 },
      { name: 'Corte + Barba', duration: 50, price: 28, color: '#0d47a1', category: 'BARBERIA', subcategory: 'Corte', points: 28 },
      { name: 'Afeitado Clásico', duration: 30, price: 15, color: '#2e7d32', category: 'BARBERIA', subcategory: 'Barba', points: 15 },
      { name: 'Diseño de Barba', duration: 25, price: 12, color: '#4caf50', category: 'BARBERIA', subcategory: 'Barba', points: 12 },
      { name: 'Fade Premium', duration: 40, price: 25, color: '#ff6f00', category: 'BARBERIA', subcategory: 'Corte', points: 25 },
    ],
    hours: { open: '10:00', close: '21:00' },
  },
  {
    name: 'Zen Spa & Wellness',
    slug: 'zen-spa',
    email: 'reservas@zenspa.com',
    businessType: 'SPA',
    description: 'Centro de bienestar holístico. Masajes terapéuticos, circuito de aguas y tratamientos corporales en un entorno de paz.',
    address: 'Paseo de la Castellana 120, Madrid',
    phone: '+34-911-003-003',
    location: { name: 'Zen Spa Castellana', address: 'Paseo de la Castellana 120, Madrid', lat: 40.4510, lng: -3.6920 },
    admin: { email: 'admin@zenspa.com', firstName: 'Isabel', lastName: 'Navarro' },
    employees: [
      { firstName: 'Lucía', lastName: 'Martín', email: 'lucia@zenspa.com', color: '#00897b', bio: 'Terapeuta certificada en masaje tailandés y shiatsu' },
      { firstName: 'Elena', lastName: 'García', email: 'elena@zenspa.com', color: '#7b1fa2', bio: 'Especialista en reflexología y aromaterapia' },
      { firstName: 'Rosa', lastName: 'Delgado', email: 'rosa@zenspa.com', color: '#c62828', bio: 'Experta en envolturas corporales y exfoliaciones' },
    ],
    services: [
      { name: 'Masaje Relajante', duration: 60, price: 55, color: '#00897b', category: 'SPA', subcategory: 'Masajes', points: 55 },
      { name: 'Masaje Deportivo', duration: 60, price: 65, color: '#1565c0', category: 'SPA', subcategory: 'Masajes', points: 65 },
      { name: 'Masaje Hot Stones', duration: 75, price: 80, color: '#e65100', category: 'SPA', subcategory: 'Masajes', points: 80 },
      { name: 'Reflexología Podal', duration: 45, price: 40, color: '#7b1fa2', category: 'SPA', subcategory: 'Terapias', points: 40 },
      { name: 'Envoltura Chocolate', duration: 60, price: 70, color: '#5d4037', category: 'SPA', subcategory: 'Tratamientos Corporales', points: 70 },
      { name: 'Circuito de Aguas', duration: 90, price: 35, color: '#0097a7', category: 'SPA', subcategory: 'Hidroterapia', points: 35 },
    ],
    hours: { open: '10:00', close: '21:00' },
  },
  {
    name: 'Clínica Derma Plus',
    slug: 'derma-plus',
    email: 'citas@dermaplus.com',
    businessType: 'CLINICA',
    description: 'Clínica de medicina estética y dermatología avanzada. Tratamientos faciales con tecnología de última generación.',
    address: 'Calle Serrano 55, Madrid',
    phone: '+34-911-004-004',
    location: { name: 'Clínica Serrano', address: 'Calle Serrano 55, Madrid', lat: 40.4310, lng: -3.6860 },
    admin: { email: 'admin@dermaplus.com', firstName: 'Patricia', lastName: 'Sánchez' },
    employees: [
      { firstName: 'Dr. Miguel', lastName: 'Ortega', email: 'miguel@dermaplus.com', color: '#1565c0', bio: 'Dermatólogo colegiado, especialista en rejuvenecimiento facial' },
      { firstName: 'Dra. Carmen', lastName: 'Vega', email: 'carmen@dermaplus.com', color: '#ad1457', bio: 'Médico estético, experta en ácido hialurónico y botox' },
    ],
    services: [
      { name: 'Limpieza Facial Profunda', duration: 60, price: 65, color: '#1565c0', category: 'CLINICA', subcategory: 'Faciales', points: 65 },
      { name: 'Microdermoabrasión', duration: 45, price: 90, color: '#0097a7', category: 'CLINICA', subcategory: 'Faciales', points: 90 },
      { name: 'Peeling Químico', duration: 30, price: 110, color: '#7b1fa2', category: 'CLINICA', subcategory: 'Tratamientos', points: 110 },
      { name: 'Mesoterapia Facial', duration: 45, price: 150, color: '#ad1457', category: 'CLINICA', subcategory: 'Tratamientos', points: 150 },
      { name: 'Consulta Dermatológica', duration: 30, price: 80, color: '#2e7d32', category: 'CLINICA', subcategory: 'Consultas', points: 80 },
    ],
    hours: { open: '09:00', close: '19:00' },
  },
  {
    name: 'Nails Factory',
    slug: 'nails-factory',
    email: 'hola@nailsfactory.com',
    businessType: 'SALON',
    description: 'El paraíso de las uñas. Manicure, pedicure, nail art y extensiones. Más de 500 colores disponibles.',
    address: 'Calle Princesa 25, Madrid',
    phone: '+34-911-005-005',
    location: { name: 'Nails Factory Princesa', address: 'Calle Princesa 25, Madrid', lat: 40.4280, lng: -3.7140 },
    admin: { email: 'admin@nailsfactory.com', firstName: 'Ana', lastName: 'Morales' },
    employees: [
      { firstName: 'Valentina', lastName: 'Cruz', email: 'valentina@nailsfactory.com', color: '#e91e63', bio: 'Nail artist premiada, especialista en diseños 3D' },
      { firstName: 'Camila', lastName: 'Rojas', email: 'camila@nailsfactory.com', color: '#ff6f00', bio: 'Experta en gel y acrílico, certificada internacionalmente' },
      { firstName: 'Paula', lastName: 'Silva', email: 'paula@nailsfactory.com', color: '#7b1fa2', bio: 'Especialista en pedicure spa y cuidado de pies' },
    ],
    services: [
      { name: 'Manicure Express', duration: 25, price: 15, color: '#e91e63', category: 'SALON', subcategory: 'Manicure y Pedicure', points: 15 },
      { name: 'Manicure Semipermanente', duration: 40, price: 28, color: '#ad1457', category: 'SALON', subcategory: 'Manicure y Pedicure', points: 28 },
      { name: 'Uñas Acrílicas', duration: 75, price: 45, color: '#ff6f00', category: 'SALON', subcategory: 'Extensiones', points: 45 },
      { name: 'Nail Art Diseño', duration: 30, price: 20, color: '#7b1fa2', category: 'SALON', subcategory: 'Nail Art', points: 20 },
      { name: 'Pedicure Spa', duration: 50, price: 35, color: '#0097a7', category: 'SALON', subcategory: 'Manicure y Pedicure', points: 35 },
      { name: 'Retiro de Gel/Acrílico', duration: 30, price: 12, color: '#795548', category: 'SALON', subcategory: 'Mantenimiento', points: 12 },
    ],
    hours: { open: '10:00', close: '20:00' },
  },
  {
    name: 'Corta y Calla',
    slug: 'corta-y-calla',
    email: 'info@cortaycalla.com',
    businessType: 'BARBERIA',
    description: 'Barbería moderna con actitud rockera. Música en vivo los viernes. Tu corte, tu estilo, sin excusas.',
    address: 'Calle Malasaña 12, Madrid',
    phone: '+34-911-006-006',
    location: { name: 'Corta y Calla Malasaña', address: 'Calle Malasaña 12, Madrid', lat: 40.4270, lng: -3.7050 },
    admin: { email: 'admin@cortaycalla.com', firstName: 'Rubén', lastName: 'Díaz' },
    employees: [
      { firstName: 'Alejandro', lastName: 'Muñoz', email: 'alex@cortaycalla.com', color: '#d32f2f', bio: 'Barbero old school, 15 años de navaja' },
      { firstName: 'Sergio', lastName: 'Blanco', email: 'sergio@cortaycalla.com', color: '#1565c0', bio: 'Experto en cortes urbanos y degradados artísticos' },
      { firstName: 'Marcos', lastName: 'Gil', email: 'marcos@cortaycalla.com', color: '#2e7d32', bio: 'Joven talento especializado en texturas y volumen' },
    ],
    services: [
      { name: 'Corte Rock', duration: 35, price: 22, color: '#d32f2f', category: 'BARBERIA', subcategory: 'Corte', points: 22 },
      { name: 'Afeitado Navaja', duration: 35, price: 18, color: '#424242', category: 'BARBERIA', subcategory: 'Barba', points: 18 },
      { name: 'Degradado Artístico', duration: 45, price: 28, color: '#1565c0', category: 'BARBERIA', subcategory: 'Corte', points: 28 },
      { name: 'Corte + Barba Completo', duration: 55, price: 32, color: '#2e7d32', category: 'BARBERIA', subcategory: 'Corte', points: 32 },
      { name: 'Tinte Barba', duration: 20, price: 10, color: '#795548', category: 'BARBERIA', subcategory: 'Barba', points: 10 },
    ],
    hours: { open: '11:00', close: '21:00' },
  },
  {
    name: 'Glow Beauty Studio',
    slug: 'glow-beauty',
    email: 'hello@glowbeauty.com',
    businessType: 'SALON',
    description: 'Estudio de maquillaje y cejas perfecto para novias, eventos y sesiones fotográficas. Productos de alta gama.',
    address: 'Calle Velázquez 30, Madrid',
    phone: '+34-911-007-007',
    location: { name: 'Glow Studio Velázquez', address: 'Calle Velázquez 30, Madrid', lat: 40.4290, lng: -3.6830 },
    admin: { email: 'admin@glowbeauty.com', firstName: 'Marina', lastName: 'Reyes' },
    employees: [
      { firstName: 'Natalia', lastName: 'Campos', email: 'natalia@glowbeauty.com', color: '#e91e63', bio: 'Maquilladora profesional, ha trabajado en cine y TV' },
      { firstName: 'Lorena', lastName: 'Aguilar', email: 'lorena@glowbeauty.com', color: '#ff6f00', bio: 'Especialista en micropigmentación y diseño de cejas' },
    ],
    services: [
      { name: 'Maquillaje Social', duration: 45, price: 40, color: '#e91e63', category: 'SALON', subcategory: 'Maquillaje', points: 40 },
      { name: 'Maquillaje Novia', duration: 90, price: 120, color: '#ad1457', category: 'SALON', subcategory: 'Maquillaje', points: 120 },
      { name: 'Diseño de Cejas', duration: 30, price: 18, color: '#795548', category: 'SALON', subcategory: 'Cejas y Pestañas', points: 18 },
      { name: 'Extensiones de Pestañas', duration: 75, price: 55, color: '#ff6f00', category: 'SALON', subcategory: 'Cejas y Pestañas', points: 55 },
      { name: 'Lash Lifting', duration: 45, price: 35, color: '#7b1fa2', category: 'SALON', subcategory: 'Cejas y Pestañas', points: 35 },
      { name: 'Micropigmentación Cejas', duration: 120, price: 200, color: '#5d4037', category: 'SALON', subcategory: 'Micropigmentación', points: 200 },
    ],
    hours: { open: '09:30', close: '19:30' },
  },
  {
    name: 'Thai Harmony',
    slug: 'thai-harmony',
    email: 'reservas@thaiharmony.com',
    businessType: 'SPA',
    description: 'Auténtico spa tailandés con terapeutas formadas en Chiang Mai. Masajes tradicionales y rituales orientales.',
    address: 'Calle Alcalá 95, Madrid',
    phone: '+34-911-008-008',
    location: { name: 'Thai Harmony Alcalá', address: 'Calle Alcalá 95, Madrid', lat: 40.4230, lng: -3.6780 },
    admin: { email: 'admin@thaiharmony.com', firstName: 'Pim', lastName: 'Suksawat' },
    employees: [
      { firstName: 'Nong', lastName: 'Kaew', email: 'nong@thaiharmony.com', color: '#ff6f00', bio: 'Terapeuta tailandesa, 20 años de práctica en Chiang Mai' },
      { firstName: 'Mali', lastName: 'Prasert', email: 'mali@thaiharmony.com', color: '#00897b', bio: 'Especialista en masaje con aceites esenciales tailandeses' },
    ],
    services: [
      { name: 'Masaje Tailandés Tradicional', duration: 90, price: 75, color: '#ff6f00', category: 'SPA', subcategory: 'Masajes', points: 75 },
      { name: 'Masaje Aceites Aromáticos', duration: 60, price: 60, color: '#00897b', category: 'SPA', subcategory: 'Masajes', points: 60 },
      { name: 'Ritual Thai Completo', duration: 120, price: 110, color: '#7b1fa2', category: 'SPA', subcategory: 'Rituales', points: 110 },
      { name: 'Masaje Pies Thai', duration: 45, price: 35, color: '#5d4037', category: 'SPA', subcategory: 'Masajes', points: 35 },
      { name: 'Masaje Espalda y Cuello', duration: 30, price: 30, color: '#1565c0', category: 'SPA', subcategory: 'Masajes', points: 30 },
    ],
    hours: { open: '10:00', close: '22:00' },
  },
  {
    name: 'Clínica Estética Renovar',
    slug: 'clinica-renovar',
    email: 'citas@clinicarenovar.com',
    businessType: 'CLINICA',
    description: 'Centro integral de medicina estética. Láser, depilación definitiva, tratamientos corporales y faciales con resultados visibles.',
    address: 'Calle Goya 40, Madrid',
    phone: '+34-911-009-009',
    location: { name: 'Renovar Goya', address: 'Calle Goya 40, Madrid', lat: 40.4250, lng: -3.6790 },
    admin: { email: 'admin@clinicarenovar.com', firstName: 'Sofía', lastName: 'Castellano' },
    employees: [
      { firstName: 'Dra. Ana', lastName: 'Prieto', email: 'ana@clinicarenovar.com', color: '#ad1457', bio: 'Médico estético, especialista en láser y rejuvenecimiento' },
      { firstName: 'Teresa', lastName: 'Romero', email: 'teresa@clinicarenovar.com', color: '#0097a7', bio: 'Técnico láser certificada con 8 años de experiencia' },
      { firstName: 'Marta', lastName: 'Jiménez', email: 'marta@clinicarenovar.com', color: '#2e7d32', bio: 'Esteticista avanzada en tratamientos corporales' },
    ],
    services: [
      { name: 'Depilación Láser Axilas', duration: 15, price: 40, color: '#ad1457', category: 'CLINICA', subcategory: 'Depilación Láser', points: 40 },
      { name: 'Depilación Láser Piernas', duration: 45, price: 120, color: '#e91e63', category: 'CLINICA', subcategory: 'Depilación Láser', points: 120 },
      { name: 'Depilación Láser Facial', duration: 15, price: 35, color: '#ff6f00', category: 'CLINICA', subcategory: 'Depilación Láser', points: 35 },
      { name: 'Radiofrecuencia Facial', duration: 45, price: 85, color: '#0097a7', category: 'CLINICA', subcategory: 'Tratamientos', points: 85 },
      { name: 'Presoterapia', duration: 45, price: 40, color: '#2e7d32', category: 'CLINICA', subcategory: 'Tratamientos Corporales', points: 40 },
      { name: 'Cavitación', duration: 40, price: 55, color: '#1565c0', category: 'CLINICA', subcategory: 'Tratamientos Corporales', points: 55 },
    ],
    hours: { open: '09:00', close: '20:00' },
  },
  {
    name: 'Rizos & Co.',
    slug: 'rizos-and-co',
    email: 'hola@rizosandco.com',
    businessType: 'SALON',
    description: 'El primer salón en Madrid especializado 100% en cabello rizado y afro. Curly girl method y productos naturales.',
    address: 'Calle Lavapiés 18, Madrid',
    phone: '+34-911-010-010',
    location: { name: 'Rizos Lavapiés', address: 'Calle Lavapiés 18, Madrid', lat: 40.4090, lng: -3.7010 },
    admin: { email: 'admin@rizosandco.com', firstName: 'Keyla', lastName: 'Santos' },
    employees: [
      { firstName: 'Keyla', lastName: 'Santos', email: 'keyla@rizosandco.com', color: '#ff6f00', bio: 'Fundadora, curly specialist certificada, pelo afro y rizado' },
      { firstName: 'Aisha', lastName: 'Bah', email: 'aisha@rizosandco.com', color: '#7b1fa2', bio: 'Experta en trenzas, locks y estilos protectores' },
    ],
    services: [
      { name: 'Corte Curly', duration: 60, price: 45, color: '#ff6f00', category: 'SALON', subcategory: 'Corte', points: 45 },
      { name: 'Hidratación Profunda', duration: 45, price: 35, color: '#4caf50', category: 'SALON', subcategory: 'Tratamientos', points: 35 },
      { name: 'Definición de Rizos', duration: 60, price: 40, color: '#7b1fa2', category: 'SALON', subcategory: 'Styling', points: 40 },
      { name: 'Trenzas Box Braids', duration: 180, price: 120, color: '#5d4037', category: 'SALON', subcategory: 'Trenzas', points: 120 },
      { name: 'Big Chop + Styling', duration: 45, price: 30, color: '#e91e63', category: 'SALON', subcategory: 'Corte', points: 30 },
      { name: 'Transición Curly Girl', duration: 75, price: 50, color: '#0097a7', category: 'SALON', subcategory: 'Consultas', points: 50 },
    ],
    hours: { open: '10:00', close: '19:00' },
  },
];

// ─── HELPER: CREATE FULL BUSINESS ──────────────────────────────────────────

async function createBusiness(
  biz: typeof BUSINESSES[0],
  passwordHash: string,
  permissionMap: Map<string, string>,
) {
  // 1. Create tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: biz.slug },
    update: {
      isMarketplaceListed: true,
      businessType: biz.businessType,
      description: biz.description,
      address: biz.address,
    },
    create: {
      name: biz.name,
      slug: biz.slug,
      email: biz.email,
      phone: biz.phone,
      timezone: 'Europe/Madrid',
      currency: 'EUR',
      businessType: biz.businessType,
      description: biz.description,
      address: biz.address,
      subscriptionPlan: 'professional',
      subscriptionStatus: 'active',
      isMarketplaceListed: true,
      settings: {},
    },
  });

  // 2. Create location
  const location = await prisma.location.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: biz.location.name } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: biz.location.name,
      address: biz.location.address,
      phone: biz.phone,
      latitude: biz.location.lat,
      longitude: biz.location.lng,
      isActive: true,
    },
  });

  // 3. Create roles (all 7 system roles)
  const ROLE_SLUGS = ['owner', 'admin', 'manager', 'frontdesk', 'staff', 'accountant', 'readonly'];
  const ROLE_NAMES: Record<string, string> = {
    owner: 'Owner', admin: 'Admin', manager: 'Manager',
    frontdesk: 'Front Desk', staff: 'Staff', accountant: 'Accountant', readonly: 'Read Only',
  };

  const roleMap = new Map<string, string>();
  for (const slug of ROLE_SLUGS) {
    const existing = await prisma.role.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug } },
    });
    if (existing) {
      roleMap.set(slug, existing.id);
    } else {
      const role = await prisma.role.create({
        data: {
          tenantId: tenant.id,
          name: ROLE_NAMES[slug],
          slug,
          isSystem: true,
        },
      });
      roleMap.set(slug, role.id);

      // Assign all permissions to owner role
      if (slug === 'owner') {
        const allPermIds = Array.from(permissionMap.values());
        await prisma.rolePermission.createMany({
          data: allPermIds.map((permissionId) => ({ roleId: role.id, permissionId })),
          skipDuplicates: true,
        });
      }
    }
  }

  // 4. Create admin user
  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: biz.admin.email } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: biz.admin.email,
      passwordHash,
      firstName: biz.admin.firstName,
      lastName: biz.admin.lastName,
      isActive: true,
    },
  });

  // Assign owner role
  const ownerRoleId = roleMap.get('owner');
  if (ownerRoleId) {
    const existing = await prisma.userRole.findFirst({
      where: { userId: adminUser.id, roleId: ownerRoleId, tenantId: tenant.id },
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: adminUser.id, roleId: ownerRoleId, tenantId: tenant.id },
      });
    }
  }

  // 5. Create services
  const serviceMap = new Map<string, string>();
  for (let i = 0; i < biz.services.length; i++) {
    const svc = biz.services[i];
    const existing = await prisma.service.findFirst({
      where: { tenantId: tenant.id, name: svc.name },
    });
    if (existing) {
      serviceMap.set(svc.name, existing.id);
    } else {
      const service = await prisma.service.create({
        data: {
          tenantId: tenant.id,
          name: svc.name,
          durationMinutes: svc.duration,
          price: svc.price,
          color: svc.color,
          category: svc.category,
          subcategory: svc.subcategory,
          pointsReward: svc.points,
          currency: 'EUR',
          isActive: true,
          sortOrder: i + 1,
        },
      });
      serviceMap.set(svc.name, service.id);
    }
  }

  // 6. Create employees with schedules + assign all services
  for (const emp of biz.employees) {
    const existing = await prisma.employee.findFirst({
      where: { tenantId: tenant.id, email: emp.email },
    });

    let employeeId: string;
    if (existing) {
      employeeId = existing.id;
    } else {
      const employee = await prisma.employee.create({
        data: {
          tenantId: tenant.id,
          locationId: location.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          color: emp.color,
          bio: emp.bio,
          isActive: true,
        },
      });
      employeeId = employee.id;

      // Assign all services to employee
      const allServiceIds = Array.from(serviceMap.values());
      await prisma.employeeService.createMany({
        data: allServiceIds.map((serviceId) => ({
          employeeId,
          serviceId,
        })),
        skipDuplicates: true,
      });

      // Create schedules (work days)
      const effectiveFrom = new Date('2024-01-01');
      for (const day of WORK_DAYS) {
        await prisma.employeeSchedule.create({
          data: {
            employeeId,
            dayOfWeek: day,
            startTime: biz.hours.open,
            endTime: biz.hours.close,
            isWorking: true,
            effectiveFrom,
          },
        });
      }
      // Sunday off
      await prisma.employeeSchedule.create({
        data: {
          employeeId,
          dayOfWeek: 'SUNDAY',
          startTime: biz.hours.open,
          endTime: biz.hours.close,
          isWorking: false,
          effectiveFrom,
        },
      });
    }
  }

  // 7. Create business hours
  const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
  for (const day of daysOfWeek) {
    await prisma.businessHours.upsert({
      where: { tenantId_dayOfWeek: { tenantId: tenant.id, dayOfWeek: day } },
      update: {},
      create: {
        tenantId: tenant.id,
        dayOfWeek: day,
        openTime: biz.hours.open,
        closeTime: biz.hours.close,
        isOpen: day !== 'SUNDAY',
      },
    });
  }

  console.log(`  ✓ ${biz.name} (${biz.slug}) — admin: ${biz.admin.email}`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Seeding 10 Marketplace Businesses ===\n');

  const passwordHash = await bcrypt.hash('Admin123!', 12);

  // Get all permissions
  const permissions = await prisma.permission.findMany();
  const permissionMap = new Map<string, string>();
  for (const p of permissions) {
    permissionMap.set(`${p.module}.${p.action}`, p.id);
  }

  if (permissionMap.size === 0) {
    console.error('ERROR: No permissions found. Run the main seed first: npm run db:seed');
    process.exit(1);
  }

  for (const biz of BUSINESSES) {
    await createBusiness(biz, passwordHash, permissionMap);
  }

  console.log('\n=== Done! ===\n');
  console.log('All admin passwords: Admin123!\n');
  console.log('Business admin credentials:');
  console.log('─'.repeat(60));
  for (const biz of BUSINESSES) {
    console.log(`  ${biz.name.padEnd(28)} ${biz.admin.email.padEnd(32)} ${biz.slug}`);
  }
  console.log('─'.repeat(60));
  console.log('\nDashboard URL: http://localhost:3000/login');
  console.log('Marketplace URL: http://localhost:3000/marketplace');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
