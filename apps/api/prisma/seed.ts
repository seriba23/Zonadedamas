import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
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

// ─── PERMISSIONS ─────────────────────────────────────────────────────────────

const PERMISSIONS = [
  // appointments
  { module: 'appointments', action: 'create', description: 'Create appointments' },
  { module: 'appointments', action: 'read', description: 'Read/view appointments' },
  { module: 'appointments', action: 'update', description: 'Update appointments' },
  { module: 'appointments', action: 'delete', description: 'Delete appointments' },
  { module: 'appointments', action: 'cancel', description: 'Cancel appointments' },
  { module: 'appointments', action: 'reschedule', description: 'Reschedule appointments' },
  { module: 'appointments', action: 'complete', description: 'Mark appointments as complete' },
  // availability
  { module: 'availability', action: 'read', description: 'View availability' },
  { module: 'availability', action: 'manage', description: 'Manage availability settings' },
  // clients
  { module: 'clients', action: 'create', description: 'Create clients' },
  { module: 'clients', action: 'read', description: 'Read/view clients' },
  { module: 'clients', action: 'update', description: 'Update clients' },
  { module: 'clients', action: 'delete', description: 'Delete clients' },
  { module: 'clients', action: 'export', description: 'Export clients data' },
  // services
  { module: 'services', action: 'create', description: 'Create services' },
  { module: 'services', action: 'read', description: 'Read/view services' },
  { module: 'services', action: 'update', description: 'Update services' },
  { module: 'services', action: 'delete', description: 'Delete services' },
  // employees
  { module: 'employees', action: 'create', description: 'Create employees' },
  { module: 'employees', action: 'read', description: 'Read/view employees' },
  { module: 'employees', action: 'update', description: 'Update employees' },
  { module: 'employees', action: 'delete', description: 'Delete employees' },
  { module: 'employees', action: 'manage_schedule', description: 'Manage employee schedules' },
  { module: 'employees', action: 'manage_time_off', description: 'Manage employee time off' },
  { module: 'employees', action: 'manage_services', description: 'Manage employee services and commissions' },
  // resources
  { module: 'resources', action: 'create', description: 'Create resources' },
  { module: 'resources', action: 'read', description: 'Read/view resources' },
  { module: 'resources', action: 'update', description: 'Update resources' },
  { module: 'resources', action: 'delete', description: 'Delete resources' },
  // payments
  { module: 'payments', action: 'create', description: 'Create payments' },
  { module: 'payments', action: 'read', description: 'Read/view payments' },
  { module: 'payments', action: 'refund', description: 'Process refunds' },
  { module: 'payments', action: 'export', description: 'Export payment data' },
  // reports
  { module: 'reports', action: 'revenue', description: 'View revenue reports' },
  { module: 'reports', action: 'appointments', description: 'View appointment reports' },
  { module: 'reports', action: 'staff', description: 'View staff reports' },
  { module: 'reports', action: 'clients', description: 'View client reports' },
  // audit
  { module: 'audit', action: 'read', description: 'Read audit logs' },
  // automations
  { module: 'automations', action: 'create', description: 'Create automation rules' },
  { module: 'automations', action: 'read', description: 'Read/view automation rules' },
  { module: 'automations', action: 'update', description: 'Update automation rules' },
  { module: 'automations', action: 'delete', description: 'Delete automation rules' },
  { module: 'automations', action: 'execute', description: 'Execute automation rules manually' },
  // tenant
  { module: 'tenant', action: 'read', description: 'View tenant/business settings' },
  { module: 'tenant', action: 'update', description: 'Update tenant/business settings' },
  // settings
  { module: 'settings', action: 'general', description: 'Manage general settings' },
  { module: 'settings', action: 'billing', description: 'Manage billing settings' },
  { module: 'settings', action: 'integrations', description: 'Manage integrations' },
  // roles
  { module: 'roles', action: 'create', description: 'Create roles' },
  { module: 'roles', action: 'read', description: 'Read/view roles' },
  { module: 'roles', action: 'update', description: 'Update roles' },
  { module: 'roles', action: 'delete', description: 'Delete roles' },
  // users
  { module: 'users', action: 'create', description: 'Create users' },
  { module: 'users', action: 'read', description: 'Read/view users' },
  { module: 'users', action: 'update', description: 'Update users' },
  { module: 'users', action: 'delete', description: 'Delete users' },
  { module: 'users', action: 'invite', description: 'Invite users' },
  // locations
  { module: 'locations', action: 'create', description: 'Create locations' },
  { module: 'locations', action: 'read', description: 'Read/view locations' },
  { module: 'locations', action: 'update', description: 'Update locations' },
  { module: 'locations', action: 'delete', description: 'Delete locations' },
  // notifications
  { module: 'notifications', action: 'manage', description: 'Manage notification templates' },
  // rewards
  { module: 'rewards', action: 'create', description: 'Create rewards' },
  { module: 'rewards', action: 'read', description: 'Read/view rewards' },
  { module: 'rewards', action: 'update', description: 'Update rewards' },
  { module: 'rewards', action: 'delete', description: 'Delete/deactivate rewards' },
  // inventory
  { module: 'inventory', action: 'create', description: 'Create products/suppliers' },
  { module: 'inventory', action: 'read', description: 'Read/view inventory' },
  { module: 'inventory', action: 'update', description: 'Update products/suppliers' },
  { module: 'inventory', action: 'delete', description: 'Delete products/suppliers' },
  // promotions
  { module: 'promotions', action: 'create', description: 'Create promotions' },
  { module: 'promotions', action: 'read', description: 'Read/view promotions' },
  { module: 'promotions', action: 'update', description: 'Update promotions' },
  { module: 'promotions', action: 'delete', description: 'Delete promotions' },
];

// ─── ROLE PERMISSION MAPPING ─────────────────────────────────────────────────

type PermissionKey = `${string}.${string}`;

const permKey = (module: string, action: string): PermissionKey =>
  `${module}.${action}` as PermissionKey;

const ALL_PERMISSIONS: PermissionKey[] = PERMISSIONS.map((p) =>
  permKey(p.module, p.action)
);

// ─── OWNER: Todo sin excepción ─────────────────────
// (uses ALL_PERMISSIONS directly)

// ─── ADMIN: Todo excepto facturación/billing ───────
const ADMIN_EXCLUDED: PermissionKey[] = [permKey('settings', 'billing')];

// ─── MANAGER: Gestiona operaciones diarias ─────────
// Puede hacer casi todo operativo pero NO puede:
// - Modificar settings de billing/integraciones
// - Crear/eliminar roles o usuarios
// - Eliminar empleados/servicios/clientes (solo desactivar)
const MANAGER_PERMISSIONS: PermissionKey[] = [
  // Citas: control total
  permKey('appointments', 'create'),
  permKey('appointments', 'read'),
  permKey('appointments', 'update'),
  permKey('appointments', 'cancel'),
  permKey('appointments', 'reschedule'),
  permKey('appointments', 'complete'),
  // Disponibilidad
  permKey('availability', 'read'),
  permKey('availability', 'manage'),
  // Clientes: gestión completa
  permKey('clients', 'create'),
  permKey('clients', 'read'),
  permKey('clients', 'update'),
  permKey('clients', 'export'),
  // Servicios: ver y editar (no eliminar)
  permKey('services', 'create'),
  permKey('services', 'read'),
  permKey('services', 'update'),
  // Empleados: gestión completa
  permKey('employees', 'create'),
  permKey('employees', 'read'),
  permKey('employees', 'update'),
  permKey('employees', 'manage_schedule'),
  permKey('employees', 'manage_time_off'),
  permKey('employees', 'manage_services'),
  // Recursos
  permKey('resources', 'create'),
  permKey('resources', 'read'),
  permKey('resources', 'update'),
  // Pagos y POS
  permKey('payments', 'create'),
  permKey('payments', 'read'),
  permKey('payments', 'refund'),
  permKey('payments', 'export'),
  // Reportes: todos
  permKey('reports', 'revenue'),
  permKey('reports', 'appointments'),
  permKey('reports', 'staff'),
  permKey('reports', 'clients'),
  // Inventario: gestión completa
  permKey('inventory', 'create'),
  permKey('inventory', 'read'),
  permKey('inventory', 'update'),
  // Promociones: gestión completa
  permKey('promotions', 'create'),
  permKey('promotions', 'read'),
  permKey('promotions', 'update'),
  // Recompensas: ver y gestionar
  permKey('rewards', 'create'),
  permKey('rewards', 'read'),
  permKey('rewards', 'update'),
  // Notificaciones
  permKey('notifications', 'manage'),
  // Automatizaciones: ver
  permKey('automations', 'read'),
  permKey('automations', 'create'),
  permKey('automations', 'update'),
  // Ubicaciones, usuarios, roles: solo lectura
  permKey('locations', 'read'),
  permKey('users', 'read'),
  permKey('roles', 'read'),
  // Negocio: ver info
  permKey('tenant', 'read'),
];

// ─── FRONTDESK (Recepcionista): Atiende clientes ───
// Agenda citas, cobra, gestiona clientes
// NO puede: ver reportes financieros, gestionar empleados, inventario
const FRONTDESK_PERMISSIONS: PermissionKey[] = [
  // Citas: gestión completa del día a día
  permKey('appointments', 'create'),
  permKey('appointments', 'read'),
  permKey('appointments', 'update'),
  permKey('appointments', 'cancel'),
  permKey('appointments', 'reschedule'),
  permKey('appointments', 'complete'),
  // Disponibilidad: consultar
  permKey('availability', 'read'),
  // Clientes: crear y editar (llegan clientes nuevos)
  permKey('clients', 'create'),
  permKey('clients', 'read'),
  permKey('clients', 'update'),
  // Servicios y empleados: consultar para agendar
  permKey('services', 'read'),
  permKey('employees', 'read'),
  permKey('resources', 'read'),
  // Pagos: cobrar en POS
  permKey('payments', 'create'),
  permKey('payments', 'read'),
  // Recompensas: validar cupones
  permKey('rewards', 'read'),
  // Promociones: consultar para aplicar
  permKey('promotions', 'read'),
  // Ubicaciones
  permKey('locations', 'read'),
  // Reportes básicos: ver citas del día
  permKey('reports', 'appointments'),
];

// ─── STAFF (Empleado/Estilista): Su propia agenda ──
// Ve sus citas, completa servicios, ve clientes asignados
// NO puede: crear citas, cobrar, ver reportes, gestionar nada
const STAFF_PERMISSIONS: PermissionKey[] = [
  // Citas: ver las suyas y marcar completadas
  permKey('appointments', 'read'),
  permKey('appointments', 'complete'),
  // Disponibilidad: ver su horario
  permKey('availability', 'read'),
  // Clientes: ver info del cliente para atenderlo
  permKey('clients', 'read'),
  // Servicios: ver catálogo
  permKey('services', 'read'),
  // Empleados: ver compañeros (horarios)
  permKey('employees', 'read'),
  // Recursos: ver disponibilidad de salas
  permKey('resources', 'read'),
  // Recompensas: ver (informar al cliente)
  permKey('rewards', 'read'),
  // Ubicaciones
  permKey('locations', 'read'),
];

// ─── ACCOUNTANT (Contador): Números y finanzas ─────
// Ve todo lo financiero pero NO puede modificar operaciones
const ACCOUNTANT_PERMISSIONS: PermissionKey[] = [
  // Pagos: ver y exportar
  permKey('payments', 'read'),
  permKey('payments', 'export'),
  // Reportes: todos los financieros
  permKey('reports', 'revenue'),
  permKey('reports', 'appointments'),
  permKey('reports', 'staff'),
  permKey('reports', 'clients'),
  // Consultar datos para contexto
  permKey('appointments', 'read'),
  permKey('clients', 'read'),
  permKey('clients', 'export'),
  permKey('services', 'read'),
  permKey('employees', 'read'),
  permKey('locations', 'read'),
  // Inventario: ver costos y stock
  permKey('inventory', 'read'),
  // Promociones: ver descuentos aplicados
  permKey('promotions', 'read'),
  // Recompensas: ver canjes
  permKey('rewards', 'read'),
];

// ─── READONLY (Solo lectura): Observador ───────────
// Ve todo pero no puede modificar nada
const READONLY_PERMISSIONS: PermissionKey[] = [
  permKey('appointments', 'read'),
  permKey('availability', 'read'),
  permKey('clients', 'read'),
  permKey('services', 'read'),
  permKey('employees', 'read'),
  permKey('resources', 'read'),
  permKey('payments', 'read'),
  permKey('reports', 'revenue'),
  permKey('reports', 'appointments'),
  permKey('reports', 'staff'),
  permKey('reports', 'clients'),
  permKey('locations', 'read'),
  permKey('inventory', 'read'),
  permKey('promotions', 'read'),
  permKey('rewards', 'read'),
  permKey('roles', 'read'),
  permKey('tenant', 'read'),
];

const ROLE_DEFINITIONS = [
  {
    name: 'Owner',
    slug: 'owner',
    description: 'Dueño del negocio — acceso total a todas las funciones incluyendo facturación y configuración',
    isSystem: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'Admin',
    slug: 'admin',
    description: 'Administrador — acceso total excepto facturación. Puede gestionar roles, usuarios y configuración',
    isSystem: true,
    permissions: ALL_PERMISSIONS.filter((p) => !ADMIN_EXCLUDED.includes(p)),
  },
  {
    name: 'Manager',
    slug: 'manager',
    description: 'Gerente — gestiona operaciones diarias, personal, inventario, reportes y promociones',
    isSystem: true,
    permissions: MANAGER_PERMISSIONS,
  },
  {
    name: 'Recepción',
    slug: 'frontdesk',
    description: 'Recepcionista — agenda citas, atiende clientes, cobra en POS y valida cupones',
    isSystem: true,
    permissions: FRONTDESK_PERMISSIONS,
  },
  {
    name: 'Empleado',
    slug: 'staff',
    description: 'Estilista/Profesional — ve sus citas, completa servicios y consulta clientes',
    isSystem: true,
    permissions: STAFF_PERMISSIONS,
  },
  {
    name: 'Contador',
    slug: 'accountant',
    description: 'Contador — acceso a reportes financieros, pagos, inventario y exportación de datos',
    isSystem: true,
    permissions: ACCOUNTANT_PERMISSIONS,
  },
  {
    name: 'Solo Lectura',
    slug: 'readonly',
    description: 'Observador — puede ver toda la información pero no modificar nada',
    isSystem: true,
    permissions: READONLY_PERMISSIONS,
  },
];

// ─── SEED FUNCTION ───────────────────────────────────────────────────────────

async function main() {
  console.log('Starting seed...');

  // 1. Upsert all permissions
  console.log('Seeding permissions...');
  const permissionMap = new Map<PermissionKey, string>();

  for (const perm of PERMISSIONS) {
    const created = await prisma.permission.upsert({
      where: { module_action: { module: perm.module, action: perm.action } },
      update: { description: perm.description },
      create: {
        module: perm.module,
        action: perm.action,
        description: perm.description,
      },
    });
    permissionMap.set(permKey(perm.module, perm.action), created.id);
  }
  console.log(`  ${permissionMap.size} permissions seeded.`);

  // 2. Create demo tenant
  console.log('Seeding demo tenant...');
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-salon' },
    update: {},
    create: {
      name: 'Demo Salon',
      slug: 'demo-salon',
      email: 'contact@demo-salon.com',
      phone: '+1-555-0100',
      timezone: 'America/New_York',
      currency: 'USD',
      subscriptionPlan: 'professional',
      subscriptionStatus: 'active',
      coverImageUrl: '/api/uploads/avatars/cover-1772686771095-c33kej.jpg',
      isMarketplaceListed: true,
      businessType: 'SALON',
      description: 'Salon de belleza integral con los mejores profesionales. Cortes, tintes, faciales, manicure y mas.',
      address: 'Av. Juarez 975, Centro, Guadalajara',
      settings: {},
    },
  });

  // Update tenant with cover image and marketplace listing
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      coverImageUrl: '/api/uploads/avatars/cover-1772686771095-c33kej.jpg',
      isMarketplaceListed: true,
      businessType: 'SALON',
      description: 'Salon de belleza integral con los mejores profesionales. Cortes, tintes, faciales, manicure y mas.',
      address: 'Av. Juarez 975, Centro, Guadalajara',
    },
  });

  console.log(`  Tenant: ${tenant.name} (${tenant.id})`);

  // 3. Create roles for the tenant
  console.log('Seeding roles...');
  const roleMap = new Map<string, string>(); // slug -> id

  for (const roleDef of ROLE_DEFINITIONS) {
    const existing = await prisma.role.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: roleDef.slug } },
    });

    let roleId: string;

    if (existing) {
      roleId = existing.id;
      await prisma.role.update({
        where: { id: existing.id },
        data: {
          name: roleDef.name,
          description: roleDef.description,
          isSystem: roleDef.isSystem,
        },
      });
    } else {
      const role = await prisma.role.create({
        data: {
          tenantId: tenant.id,
          name: roleDef.name,
          slug: roleDef.slug,
          description: roleDef.description,
          isSystem: roleDef.isSystem,
        },
      });
      roleId = role.id;
    }

    roleMap.set(roleDef.slug, roleId);

    // Assign permissions to this role
    const permIds = roleDef.permissions
      .map((pk) => permissionMap.get(pk))
      .filter((id): id is string => Boolean(id));

    // Remove existing permissions and re-add (idempotent)
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    if (permIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`  ${roleMap.size} roles seeded.`);

  // 4. Create locations
  console.log('Seeding locations...');

  const downtownLocation = await prisma.location.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Downtown Branch' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Downtown Branch',
      address: '123 Main Street, New York, NY 10001',
      phone: '+1-555-0101',
      email: 'downtown@demo-salon.com',
      timezone: 'America/New_York',
      isActive: true,
      settings: {},
    },
  });

  const mallLocation = await prisma.location.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Mall Branch' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Mall Branch',
      address: '456 Shopping Center Blvd, New York, NY 10002',
      phone: '+1-555-0102',
      email: 'mall@demo-salon.com',
      timezone: 'America/New_York',
      isActive: true,
      settings: {},
    },
  });

  console.log(`  Locations: ${downtownLocation.name}, ${mallLocation.name}`);

  // 5. Create owner user
  console.log('Seeding owner user...');
  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const ownerUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@siliba.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@siliba.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Owner',
      phone: '+1-555-0100',
      isActive: true,
    },
  });
  console.log(`  Owner user: ${ownerUser.email} (${ownerUser.id})`);

  // 6. Assign owner role to user
  const ownerRoleId = roleMap.get('owner');
  if (ownerRoleId) {
    const existingUserRole = await prisma.userRole.findFirst({
      where: {
        userId: ownerUser.id,
        roleId: ownerRoleId,
        tenantId: tenant.id,
        locationId: null,
      },
    });
    if (!existingUserRole) {
      await prisma.userRole.create({
        data: {
          userId: ownerUser.id,
          roleId: ownerRoleId,
          tenantId: tenant.id,
          locationId: null,
        },
      });
    }
  }
  console.log(`  Owner role assigned.`);

  // 7. Create demo services
  console.log('Seeding services...');

  const servicesData = [
    {
      name: 'Corte de Cabello',
      description: 'Corte profesional con lavado y secado',
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 5,
      price: 25.0,
      pointsReward: 25,
      color: '#6366f1',
      category: 'SALON',
      subcategory: 'Corte',
      sortOrder: 1,
    },
    {
      name: 'Tinte Completo',
      description: 'Coloración completa con productos premium',
      durationMinutes: 90,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 10,
      price: 80.0,
      pointsReward: 80,
      color: '#8b5cf6',
      category: 'SALON',
      subcategory: 'Coloración',
      sortOrder: 2,
    },
    {
      name: 'Peinado y Brushing',
      description: 'Lavado, secado y peinado profesional',
      durationMinutes: 45,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 5,
      price: 35.0,
      pointsReward: 35,
      color: '#ec4899',
      category: 'SALON',
      subcategory: 'Peinados y Styling',
      sortOrder: 3,
    },
    {
      name: 'Manicure Clásico',
      description: 'Manicure clásico con limado y esmaltado',
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 5,
      price: 20.0,
      pointsReward: 20,
      color: '#f43f5e',
      category: 'GENERAL',
      subcategory: 'Manicure y Pedicure',
      sortOrder: 4,
    },
    {
      name: 'Facial Profundo',
      description: 'Tratamiento facial de limpieza profunda',
      durationMinutes: 60,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 10,
      price: 50.0,
      pointsReward: 50,
      color: '#14b8a6',
      category: 'SPA',
      subcategory: 'Faciales',
      sortOrder: 5,
    },
  ];

  const serviceMap = new Map<string, string>(); // name -> id

  for (const svc of servicesData) {
    const existing = await prisma.service.findFirst({
      where: { tenantId: tenant.id, name: svc.name },
    });

    let serviceId: string;

    if (existing) {
      serviceId = existing.id;
    } else {
      const service = await prisma.service.create({
        data: {
          tenantId: tenant.id,
          currency: 'USD',
          isActive: true,
          ...svc,
        },
      });
      serviceId = service.id;
    }

    serviceMap.set(svc.name, serviceId);
  }
  console.log(`  ${serviceMap.size} services seeded.`);

  // 8. Create demo employees with schedules
  console.log('Seeding employees...');

  const employeesData = [
    {
      firstName: 'Maria',
      lastName: 'Garcia',
      email: 'maria@demo-salon.com',
      phone: '+1-555-0201',
      color: '#6366f1',
      avatarUrl: '/api/uploads/avatars/employee-1772686782829-95dnt0.jpg',
      bio: 'Tengo 10 anos transformando vidas desde mi silla. Mi mama me ensenó que la belleza no es vanidad, es amor propio. Cada persona que se sienta frente a mi espejo llega con una historia, y mi trabajo es ayudarla a sentirse como la protagonista que es. No solo corto cabello — devuelvo sonrisas.',
      locationId: downtownLocation.id,
      services: [
        { name: 'Corte de Cabello', commission: 15.0 },
        { name: 'Tinte Completo', commission: 40.0 },
        { name: 'Peinado y Brushing', commission: 20.0 },
      ],
    },
    {
      firstName: 'James',
      lastName: 'Wilson',
      email: 'james@demo-salon.com',
      phone: '+1-555-0202',
      color: '#10b981',
      avatarUrl: '/api/uploads/avatars/employee-1772686783325-m0beni.jpg',
      bio: 'Creci en un barrio donde los hombres no hablaban de estilo. Yo fui el primero en desafiar eso. Hoy, despues de 8 anos perfeccionando mi arte, cada tinte que mezclo lleva algo de mi alma. Me inspiran los atardeceres, la musica y esos clientes que llegan nerviosos y se van sintiendose invencibles.',
      locationId: downtownLocation.id,
      services: [
        { name: 'Corte de Cabello', commission: 15.0 },
        { name: 'Tinte Completo', commission: 40.0 },
      ],
    },
    {
      firstName: 'Sofia',
      lastName: 'Martinez',
      email: 'sofia@demo-salon.com',
      phone: '+1-555-0203',
      color: '#f59e0b',
      avatarUrl: '/api/uploads/avatars/employee-1772686783699-hoe75s.jpg',
      bio: 'Mi abuela siempre decia: "las manos hablan de quien eres". Esas palabras me marcaron para siempre. Llevo 6 anos dedicada al cuidado personal y cada clienta que atiendo se convierte en familia. Un facial no es solo un tratamiento — es una hora donde el mundo se detiene y tu eres lo unico que importa.',
      locationId: mallLocation.id,
      services: [
        { name: 'Manicure Clásico', commission: 12.0 },
        { name: 'Facial Profundo', commission: 25.0 },
      ],
    },
  ];

  const WORK_DAYS = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ] as const;

  for (const empData of employeesData) {
    const { services: empServices, locationId, ...empFields } = empData;

    const existing = await prisma.employee.findFirst({
      where: { tenantId: tenant.id, email: empData.email },
    });

    let employeeId: string;

    if (existing) {
      employeeId = existing.id;
      // Always update bio and color in case seed data changed
      await prisma.employee.update({
        where: { id: employeeId },
        data: { bio: empData.bio, color: empData.color, avatarUrl: empData.avatarUrl || null },
      });
    } else {
      const employee = await prisma.employee.create({
        data: {
          tenantId: tenant.id,
          locationId,
          isActive: true,
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
          sortOrder: 0,
          ...empFields,
        },
      });
      employeeId = employee.id;

      // Assign services with commissions
      for (const svcConfig of empServices) {
        const svcId = serviceMap.get(svcConfig.name);
        if (svcId) {
          await prisma.employeeService.upsert({
            where: {
              employeeId_serviceId: { employeeId, serviceId: svcId },
            },
            update: { commission: svcConfig.commission },
            create: {
              employeeId,
              serviceId: svcId,
              commission: svcConfig.commission,
            },
          });
        }
      }

      // Create schedules (Mon–Sat, 9:00–18:00)
      const effectiveFrom = new Date('2024-01-01');
      for (const day of WORK_DAYS) {
        await prisma.employeeSchedule.create({
          data: {
            employeeId,
            dayOfWeek: day,
            startTime: '09:00',
            endTime: '18:00',
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
          startTime: '09:00',
          endTime: '18:00',
          isWorking: false,
          effectiveFrom,
        },
      });
    }
  }
  console.log(`  ${employeesData.length} employees seeded.`);

  // 9. Create user accounts for demo employees
  console.log('Seeding employee user accounts...');
  const staffPasswordHash = await bcrypt.hash('Staff123!', 12);
  const staffRoleId = roleMap.get('staff');

  for (const empData of employeesData) {
    const employee = await prisma.employee.findFirst({
      where: { tenantId: tenant.id, email: empData.email },
    });
    if (!employee) continue;

    // Skip if employee already has a user
    if (employee.userId) continue;

    const existingUser = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: empData.email } },
    });

    if (!existingUser) {
      const empUser = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: empData.email,
          passwordHash: staffPasswordHash,
          firstName: empData.firstName,
          lastName: empData.lastName,
          phone: empData.phone,
          isActive: true,
        },
      });

      // Link employee to user
      await prisma.employee.update({
        where: { id: employee.id },
        data: { userId: empUser.id },
      });

      // Assign staff role
      if (staffRoleId) {
        await prisma.userRole.create({
          data: {
            userId: empUser.id,
            roleId: staffRoleId,
            tenantId: tenant.id,
          },
        });
      }

      console.log(`  Employee user: ${empUser.email}`);
    } else {
      // User exists but employee not linked — fix the link
      await prisma.employee.update({
        where: { id: employee.id },
        data: { userId: existingUser.id },
      });
      console.log(`  Linked existing user to employee: ${empData.email}`);
    }
  }

  // 9b. Create demo invite code
  console.log('Seeding demo invite code...');
  const existingInviteCode = await prisma.tenantInviteCode.findUnique({
    where: { code: 'DEMOSALON' },
  });
  if (!existingInviteCode) {
    await prisma.tenantInviteCode.create({
      data: {
        tenantId: tenant.id,
        code: 'DEMOSALON',
        maxUses: 0, // unlimited
        isActive: true,
      },
    });
    console.log('  Invite code: DEMOSALON');
  }

  // 10. Create demo clients
  console.log('Seeding clients...');

  const clientsData = [
    {
      firstName: 'Emily',
      lastName: 'Johnson',
      email: 'emily.johnson@example.com',
      phone: '+1-555-0301',
      gender: 'female',
      avatarUrl: '/api/uploads/avatars/client-1773293590857-v6r3xv.jpg',
      notes: 'Prefers eco-friendly products',
    },
    {
      firstName: 'Michael',
      lastName: 'Brown',
      email: 'michael.brown@example.com',
      phone: '+1-555-0302',
      gender: 'male',
      avatarUrl: '/api/uploads/avatars/client-1773293591359-fzfcza.jpg',
      notes: 'Regular monthly haircut',
    },
    {
      firstName: 'Sarah',
      lastName: 'Davis',
      email: 'sarah.davis@example.com',
      phone: '+1-555-0303',
      gender: 'female',
      avatarUrl: '/api/uploads/avatars/client-1773293591733-fgjogy.jpg',
      notes: 'Allergic to certain hair dyes - check before coloring',
    },
    {
      firstName: 'David',
      lastName: 'Miller',
      email: 'david.miller@example.com',
      phone: '+1-555-0304',
      gender: 'male',
      avatarUrl: '/api/uploads/avatars/client-1773293592105-1q6bhv.jpg',
      notes: null,
    },
    {
      firstName: 'Jessica',
      lastName: 'Wilson',
      email: 'jessica.wilson@example.com',
      phone: '+1-555-0305',
      gender: 'female',
      avatarUrl: '/api/uploads/avatars/client-1773293592479-6z1300.jpg',
      notes: 'VIP client - priority booking',
    },
    {
      firstName: 'Andrea',
      lastName: 'Lopez',
      email: 'andrea.lopez@example.com',
      phone: '+1-555-0306',
      gender: 'female',
      avatarUrl: '/api/uploads/avatars/client-1773293592839-2dewab.jpg',
      notes: 'Prefiere citas por la manana',
    },
    {
      firstName: 'Carlos',
      lastName: 'Ramirez',
      email: 'carlos.ramirez@example.com',
      phone: '+1-555-0307',
      gender: 'male',
      avatarUrl: '/api/uploads/avatars/client-1773293593212-ipzmbg.jpg',
      notes: null,
    },
    {
      firstName: 'Laura',
      lastName: 'Hernandez',
      email: 'laura.hernandez@example.com',
      phone: '+1-555-0308',
      gender: 'female',
      avatarUrl: '/api/uploads/avatars/client-1773293593570-ykebg2.jpg',
      notes: 'Cliente frecuente, le gusta probar cosas nuevas',
    },
    {
      firstName: 'Roberto',
      lastName: 'Torres',
      email: 'roberto.torres@example.com',
      phone: '+1-555-0309',
      gender: 'male',
      avatarUrl: '/api/uploads/avatars/client-1773293593945-n0ocgq.jpg',
      notes: 'Corte clasico siempre',
    },
    {
      firstName: 'Valentina',
      lastName: 'Diaz',
      email: 'valentina.diaz@example.com',
      phone: '+1-555-0310',
      gender: 'female',
      avatarUrl: '/api/uploads/avatars/client-1773293594318-am9s78.jpg',
      notes: 'Piel sensible - verificar productos',
    },
  ];

  for (const clientData of clientsData) {
    const existing = await prisma.client.findFirst({
      where: { tenantId: tenant.id, email: clientData.email },
    });

    if (existing) {
      // Update avatar if it changed
      if (clientData.avatarUrl && existing.avatarUrl !== clientData.avatarUrl) {
        await prisma.client.update({
          where: { id: existing.id },
          data: { avatarUrl: clientData.avatarUrl },
        });
      }
    } else {
      await prisma.client.create({
        data: {
          tenantId: tenant.id,
          isActive: true,
          source: 'MANUAL',
          ...clientData,
        },
      });
    }
  }
  console.log(`  ${clientsData.length} clients seeded.`);

  // Download client avatar photos from i.pravatar.cc
  console.log('Downloading client avatars...');
  // i.pravatar.cc image IDs — diverse faces, avoid IDs used for employees
  const clientAvatarIds = [3, 6, 15, 18, 27, 31, 33, 39, 41, 49];
  const avatarsDir = path.join(UPLOADS_BASE, 'avatars');
  if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

  const allClientsForAvatars = await prisma.client.findMany({
    where: { tenantId: tenant.id, email: { in: clientsData.map(c => c.email) } },
    select: { id: true, email: true, avatarUrl: true },
  });

  let clientAvatarsDownloaded = 0;
  for (let ci = 0; ci < allClientsForAvatars.length; ci++) {
    const cl = allClientsForAvatars[ci];
    if (cl.avatarUrl) continue; // already has avatar
    const imgId = clientAvatarIds[ci % clientAvatarIds.length];
    const filename = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const destPath = path.join(avatarsDir, filename);
    try {
      await downloadFile(`https://i.pravatar.cc/200?img=${imgId}`, destPath);
      await prisma.client.update({
        where: { id: cl.id },
        data: { avatarUrl: `/api/uploads/avatars/${filename}` },
      });
      clientAvatarsDownloaded++;
      await delay(300); // be nice to free API
    } catch (err) {
      console.log(`    ! Failed avatar for ${cl.email}: ${(err as Error).message}`);
    }
  }
  console.log(`  ${clientAvatarsDownloaded} client avatars downloaded.`);

  // 10. Create business hours
  console.log('Seeding business hours...');

  const businessHoursData = [
    { dayOfWeek: 'MONDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'TUESDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'WEDNESDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'THURSDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'FRIDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'SATURDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'SUNDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: false },
  ];

  for (const bh of businessHoursData) {
    await prisma.businessHours.upsert({
      where: {
        tenantId_dayOfWeek: { tenantId: tenant.id, dayOfWeek: bh.dayOfWeek },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        ...bh,
      },
    });
  }
  console.log(`  ${businessHoursData.length} business hours seeded.`);

  // 11. Create demo appointments for March 2026
  console.log('Seeding March 2026 appointments...');

  // Fetch employees and clients
  const allEmployees = await prisma.employee.findMany({
    where: { tenantId: tenant.id },
    include: { employeeServices: { include: { service: true } } },
  });

  const allClients = await prisma.client.findMany({
    where: { tenantId: tenant.id },
  });

  if (allEmployees.length > 0 && allClients.length > 0) {
    // Check if March 2026 appointments already exist
    let existingMarchApts = await prisma.appointment.count({
      where: {
        tenantId: tenant.id,
        startTime: { gte: new Date('2026-03-01T00:00:00Z') },
        endTime: { lte: new Date('2026-03-31T23:59:59Z') },
      },
    });

    // Check if reviews need updating (old seed had only 9 reviews, new one needs 30)
    const existingReviewCount = await prisma.employeeReview.count({
      where: { tenantId: tenant.id },
    });
    const needsReseed = existingMarchApts > 0 && (existingMarchApts < 30 || existingReviewCount < 20);

    // If incomplete set exists or reviews are missing, clean up first
    if (needsReseed) {
      const oldApts = await prisma.appointment.findMany({
        where: {
          tenantId: tenant.id,
          startTime: { gte: new Date('2026-03-01T00:00:00Z') },
          endTime: { lte: new Date('2026-03-31T23:59:59Z') },
        },
        select: { id: true },
      });
      const oldIds = oldApts.map(a => a.id);
      await prisma.employeeReview.deleteMany({ where: { appointmentId: { in: oldIds } } });
      await prisma.appointmentStatusHistory.deleteMany({ where: { appointmentId: { in: oldIds } } });
      await prisma.appointmentItem.deleteMany({ where: { appointmentId: { in: oldIds } } });
      await prisma.appointment.deleteMany({ where: { id: { in: oldIds } } });
      console.log(`  Cleaned ${oldIds.length} old March appointments + reviews.`);
      // Reset count so the next block creates new appointments
      existingMarchApts = 0;
    }

    if (existingMarchApts < 30) {
      const completedAppointmentIds: { id: string; employeeId: string; clientId: string }[] = [];

      // Define 10 appointment slots per employee: [day, hour, minute]
      const slotsByEmployee: Array<Array<[number, number, number]>> = [
        // Maria Garcia – spread across March
        [[2, 9, 0], [4, 10, 30], [6, 11, 0], [9, 14, 0], [11, 9, 30], [13, 15, 0], [17, 10, 0], [20, 11, 30], [24, 13, 0], [27, 16, 0]],
        // James Wilson – different days/times
        [[3, 9, 0], [5, 11, 0], [7, 14, 30], [10, 10, 0], [12, 9, 0], [16, 13, 0], [18, 15, 30], [21, 10, 30], [25, 11, 0], [28, 9, 30]],
        // Sofia Martinez – different days/times
        [[2, 10, 0], [4, 13, 0], [6, 9, 30], [9, 11, 0], [11, 14, 0], [14, 10, 30], [18, 9, 0], [20, 15, 0], [23, 13, 30], [26, 11, 0]],
      ];

      let totalCreated = 0;

      for (let empIdx = 0; empIdx < allEmployees.length; empIdx++) {
        const emp = allEmployees[empIdx];
        const empServices = emp.employeeServices;
        if (empServices.length === 0) continue;

        const slots = slotsByEmployee[empIdx] || slotsByEmployee[0];

        for (let i = 0; i < slots.length; i++) {
          const [day, hour, minute] = slots[i];
          const client = allClients[i % allClients.length];
          const empSvc = empServices[i % empServices.length];
          const service = empSvc.service;
          // All 10 slots per employee → COMPLETED for full review coverage
          const status = 'COMPLETED' as const;

          const startTime = new Date(Date.UTC(2026, 2, day, hour, minute, 0)); // month=2 → March
          const endTime = new Date(startTime.getTime() + service.durationMinutes * 60 * 1000);

          const notes = [
            'Cliente habitual',
            'Primera visita',
            'Pidió turno temprano',
            'Referida por otra clienta',
            null,
            'Llamar para confirmar un día antes',
            'Prefiere productos orgánicos',
            null,
            'Tiene prisa, puntualidad importante',
            'Viene con acompañante',
          ][i] || null;

          const appointment = await prisma.appointment.create({
            data: {
              tenantId: tenant.id,
              locationId: emp.locationId,
              clientId: client.id,
              employeeId: emp.id,
              status,
              startTime,
              endTime,
              notes,
              source: 'MANUAL',
              createdBy: ownerUser.id,
            },
          });

          await prisma.appointmentItem.create({
            data: {
              appointmentId: appointment.id,
              serviceId: service.id,
              employeeId: emp.id,
              startTime,
              endTime,
              priceSnapshot: service.price,
              durationSnapshot: service.durationMinutes,
              serviceNameSnapshot: service.name,
              commissionSnapshot: empSvc.commission,
            },
          });

          await prisma.appointmentStatusHistory.create({
            data: {
              appointmentId: appointment.id,
              fromStatus: null,
              toStatus: status,
              changedBy: ownerUser.id,
              notes: 'Creada por seed',
            },
          });

          if (status === 'COMPLETED') {
            completedAppointmentIds.push({
              id: appointment.id,
              employeeId: emp.id,
              clientId: client.id,
            });
          }

          totalCreated++;
        }
      }

      console.log(`  ${totalCreated} appointments created for March 2026.`);

      // Create reviews for completed appointments
      console.log('  Seeding reviews for completed appointments...');
      const reviewComments = [
        'Increible experiencia. Maria tiene un don para entender exactamente lo que quieres sin tener que explicar demasiado. Sali sintiendome otra persona.',
        'Llevaba meses buscando a alguien que entendiera mi tipo de cabello. Desde la primera visita supe que habia encontrado a mi estilista de confianza.',
        'El ambiente es super relajante y el trato es de primera. Me encanta que se toman el tiempo de escucharte antes de empezar.',
        'Honestamente no esperaba tanto. Me hicieron un cambio de look completo y no podia dejar de mirarme al espejo. 100% recomendado.',
        'Lo que mas valoro es la honestidad. Me dijeron que lo que queria no iba con mi tipo de rostro y me sugirieron algo mejor. Tenian toda la razon.',
        'Ya perdi la cuenta de cuantas veces he venido. Es mi lugar seguro. Siempre salgo feliz y con ganas de volver.',
        'Vine nerviosa porque nunca me habia tenido el cabello. Me explicaron todo el proceso con paciencia y el resultado fue espectacular.',
        'Excelente atencion al detalle. Se nota que aman lo que hacen. El salon esta impecable y el equipo es muy profesional.',
        'Mi hija me recomendo este salon y ahora entiendo por que. La atencion es personalizada y el resultado habla por si solo.',
        'Fui por un corte sencillo y sali con un look que me hizo sentir 10 anos mas joven. Manos magicas, sin duda.',
      ];
      const reviewRatings = [5, 5, 4, 5, 5, 4, 5, 5, 4, 5];

      let reviewsCreated = 0;
      for (let ri = 0; ri < completedAppointmentIds.length; ri++) {
        const apt = completedAppointmentIds[ri];
        const existingReview = await prisma.employeeReview.findUnique({
          where: { appointmentId: apt.id },
        });
        if (!existingReview) {
          await prisma.employeeReview.create({
            data: {
              tenantId: tenant.id,
              employeeId: apt.employeeId,
              clientId: apt.clientId,
              appointmentId: apt.id,
              rating: reviewRatings[ri % reviewRatings.length],
              comment: reviewComments[ri % reviewComments.length],
              isVisible: true,
            },
          });
          reviewsCreated++;
        }
      }
      console.log(`  ${reviewsCreated} reviews seeded.`);
    } else {
      console.log(`  March 2026 appointments already complete (${existingMarchApts}), skipping.`);
    }
  }

  // 12. Create Platform Super Admin
  console.log('Seeding platform super admin...');
  const superPasswordHash = await bcrypt.hash('Super123!', 12);
  await prisma.platformUser.upsert({
    where: { email: 'super@siliba.com' },
    update: {},
    create: {
      email: 'super@siliba.com',
      passwordHash: superPasswordHash,
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
    },
  });
  console.log('  Platform admin: super@siliba.com / Super123!');

  // 13. Create Subscription for demo tenant
  console.log('Seeding demo subscription...');
  const existingSub = await prisma.subscription.findUnique({
    where: { tenantId: tenant.id },
  });
  if (!existingSub) {
    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    const subscription = await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        plan: 'BASICO',
        status: 'ACTIVE',
        monthlyAmountUsd: 29.99,
        contractStartDate: now,
        contractEndDate: oneYearLater,
        nextBillingDate: oneMonthLater,
        lastPaymentDate: now,
      },
    });

    // Create first invoice (paid)
    await prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        tenantId: tenant.id,
        invoiceNumber: 'INV-2026-0001',
        amountUsd: 29.99,
        status: 'PAID',
        periodStart: now,
        periodEnd: oneMonthLater,
        dueDate: oneMonthLater,
        paidAt: now,
      },
    });
    console.log('  Subscription BASICO + first invoice created.');
  } else {
    console.log('  Subscription already exists, skipping.');
  }

  // ─── NOTIFICATION TEMPLATES ───────────────────────────────────────────────
  console.log('Seeding notification templates...');

  const NOTIFICATION_TEMPLATES = [
    {
      eventTrigger: 'appointment.created',
      templates: [
        {
          type: 'EMAIL' as const,
          subject: 'Tu cita ha sido agendada - {{date}}',
          bodyTemplate:
            'Hola {{clientFirstName}},\n\nTu cita ha sido agendada exitosamente.\n\nDetalles:\n- Fecha: {{date}}\n- Hora: {{time}}\n- Servicio(s): {{services}}\n- Profesional: {{employeeName}}\n- Total: ${{totalPrice}}\n\nTe esperamos.',
        },
        {
          type: 'WHATSAPP' as const,
          subject: null,
          bodyTemplate:
            'Hola {{clientFirstName}}! Tu cita ha sido agendada para el {{date}} a las {{time}} con {{employeeName}}. Servicio(s): {{services}}. Te esperamos!',
        },
      ],
    },
    {
      eventTrigger: 'appointment.confirmed',
      templates: [
        {
          type: 'EMAIL' as const,
          subject: 'Tu cita ha sido confirmada - {{date}}',
          bodyTemplate:
            'Hola {{clientFirstName}},\n\nTu cita para el {{date}} a las {{time}} ha sido confirmada.\n\nServicio(s): {{services}}\nProfesional: {{employeeName}}\n\nTe esperamos.',
        },
        {
          type: 'WHATSAPP' as const,
          subject: null,
          bodyTemplate:
            'Hola {{clientFirstName}}! Tu cita del {{date}} a las {{time}} con {{employeeName}} ha sido confirmada. Te esperamos!',
        },
      ],
    },
    {
      eventTrigger: 'appointment.rescheduled',
      templates: [
        {
          type: 'EMAIL' as const,
          subject: 'Tu cita ha sido reagendada',
          bodyTemplate:
            'Hola {{clientFirstName}},\n\nTu cita ha sido reagendada.\n\nNueva fecha: {{newDate}}\nNueva hora: {{newTime}}\nServicio(s): {{services}}\nProfesional: {{employeeName}}\n\nSi tienes alguna pregunta, no dudes en contactarnos.',
        },
        {
          type: 'WHATSAPP' as const,
          subject: null,
          bodyTemplate:
            'Hola {{clientFirstName}}! Tu cita ha sido reagendada al {{newDate}} a las {{newTime}} con {{employeeName}}. Si tienes preguntas, contactanos.',
        },
      ],
    },
    {
      eventTrigger: 'appointment.cancelled',
      templates: [
        {
          type: 'EMAIL' as const,
          subject: 'Tu cita ha sido cancelada',
          bodyTemplate:
            'Hola {{clientFirstName}},\n\nLamentamos informarte que tu cita del {{date}} a las {{time}} ha sido cancelada.\n\nServicio(s): {{services}}\nProfesional: {{employeeName}}\n\nPuedes reagendar en cualquier momento.',
        },
        {
          type: 'WHATSAPP' as const,
          subject: null,
          bodyTemplate:
            'Hola {{clientFirstName}}, tu cita del {{date}} a las {{time}} ha sido cancelada. Puedes reagendar en cualquier momento.',
        },
      ],
    },
    {
      eventTrigger: 'appointment.completed',
      templates: [
        {
          type: 'EMAIL' as const,
          subject: 'Gracias por tu visita',
          bodyTemplate:
            'Hola {{clientFirstName}},\n\nGracias por visitarnos.\n\nServicio(s): {{services}}\nProfesional: {{employeeName}}\n\nEsperamos verte pronto.',
        },
        {
          type: 'WHATSAPP' as const,
          subject: null,
          bodyTemplate:
            'Hola {{clientFirstName}}! Gracias por tu visita. Esperamos que hayas disfrutado tu {{services}} con {{employeeName}}. Te esperamos pronto!',
        },
      ],
    },
    {
      eventTrigger: 'payment.completed',
      templates: [
        {
          type: 'EMAIL' as const,
          subject: 'Pago recibido - ${{amount}}',
          bodyTemplate:
            'Hola {{clientFirstName}},\n\nHemos recibido tu pago.\n\nMonto: ${{amount}} {{currency}}\nMetodo: {{paymentMethod}}\nFecha: {{date}}\n\nGracias.',
        },
        {
          type: 'WHATSAPP' as const,
          subject: null,
          bodyTemplate:
            'Hola {{clientFirstName}}! Pago recibido: ${{amount}} {{currency}} via {{paymentMethod}}. Gracias!',
        },
      ],
    },
  ];

  let templatesCreated = 0;
  for (const group of NOTIFICATION_TEMPLATES) {
    for (const tmpl of group.templates) {
      const existing = await prisma.notificationTemplate.findFirst({
        where: {
          tenantId: tenant.id,
          eventTrigger: group.eventTrigger,
          type: tmpl.type,
        },
      });
      if (!existing) {
        await prisma.notificationTemplate.create({
          data: {
            tenantId: tenant.id,
            type: tmpl.type,
            eventTrigger: group.eventTrigger,
            subject: tmpl.subject,
            bodyTemplate: tmpl.bodyTemplate,
            isActive: true,
          },
        });
        templatesCreated++;
      }
    }
  }
  console.log(`  ${templatesCreated} notification templates seeded.`);

  // ─── MARKETPLACE SETUP ──────────────────────────────
  console.log('\nSeeding marketplace data...');

  // Update tenant with marketplace fields
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      description: 'El mejor salón de belleza de la zona. Servicios profesionales de corte, color, manicura y más.',
      isMarketplaceListed: true,
      businessType: 'SALON',
    },
  });

  // Add GPS coordinates to locations
  await prisma.location.update({
    where: { id: downtownLocation.id },
    data: { latitude: 40.7128, longitude: -74.0060 },
  });
  await prisma.location.update({
    where: { id: mallLocation.id },
    data: { latitude: 40.7580, longitude: -73.9855 },
  });

  // Create demo marketplace user
  const mktPasswordHash = await bcrypt.hash('Cliente123!', 12);
  const existingMktUser = await prisma.marketplaceUser.findUnique({
    where: { email: 'cliente@siliba.com' },
  });
  if (!existingMktUser) {
    await prisma.marketplaceUser.create({
      data: {
        email: 'cliente@siliba.com',
        passwordHash: mktPasswordHash,
        firstName: 'Maria',
        lastName: 'Garcia',
        phone: '+1-555-0200',
      },
    });
    console.log('  Marketplace user created.');
  } else {
    console.log('  Marketplace user already exists.');
  }

  // Create Alfredo marketplace user
  const alfredoMktHash = await bcrypt.hash('Cliente123!', 12);
  const existingAlfredo = await prisma.marketplaceUser.findUnique({
    where: { email: 'alfredo@siliba.com' },
  });
  let alfredoMktUser = existingAlfredo;
  if (!existingAlfredo) {
    alfredoMktUser = await prisma.marketplaceUser.create({
      data: {
        email: 'alfredo@siliba.com',
        passwordHash: alfredoMktHash,
        firstName: 'Alfredo',
        lastName: 'Rodriguez',
        phone: '+1-555-0201',
      },
    });
    console.log('  Alfredo marketplace user created.');
  } else {
    console.log('  Alfredo marketplace user already exists.');
  }

  // Link Alfredo's existing client record (or create one) and give him loyalty points + appointments
  if (alfredoMktUser) {
    let alfredoClient = await prisma.client.findFirst({
      where: { tenantId: tenant.id, email: 'alfredo@siliba.com' },
    });

    if (alfredoClient) {
      // Link to marketplace user and give loyalty points
      await prisma.client.update({
        where: { id: alfredoClient.id },
        data: { marketplaceUserId: alfredoMktUser.id, loyaltyPoints: 600 },
      });
    } else {
      alfredoClient = await prisma.client.create({
        data: {
          tenantId: tenant.id,
          marketplaceUserId: alfredoMktUser.id,
          firstName: 'Alfredo',
          lastName: 'Rodriguez',
          email: 'alfredo@siliba.com',
          phone: '+1-555-0201',
          source: 'MARKETPLACE',
          portalRegisteredAt: new Date(),
          loyaltyPoints: 600,
        },
      });
    }

    // Create completed appointments for Alfredo so he has history
    const alfredoAptsCount = await prisma.appointment.count({
      where: { clientId: alfredoClient.id },
    });

    if (alfredoAptsCount === 0 && allEmployees.length > 0) {
      const emp = allEmployees[0];
      const empServices = emp.employeeServices;
      const alfredoSlots: [number, number, number, 'COMPLETED' | 'CONFIRMED' | 'PENDING'][] = [
        [1, 10, 0, 'COMPLETED'],
        [3, 14, 0, 'COMPLETED'],
        [5, 11, 30, 'COMPLETED'],
        [8, 9, 0, 'COMPLETED'],
        [15, 10, 0, 'CONFIRMED'],
        [22, 14, 30, 'PENDING'],
      ];

      for (let i = 0; i < alfredoSlots.length; i++) {
        const [day, hour, minute, status] = alfredoSlots[i];
        const empSvc = empServices[i % empServices.length];
        const service = empSvc.service;
        const startTime = new Date(Date.UTC(2026, 2, day, hour, minute, 0));
        const endTime = new Date(startTime.getTime() + service.durationMinutes * 60 * 1000);

        const apt = await prisma.appointment.create({
          data: {
            tenantId: tenant.id,
            locationId: emp.locationId,
            clientId: alfredoClient.id,
            employeeId: emp.id,
            status,
            startTime,
            endTime,
            notes: i === 0 ? 'Cliente frecuente' : null,
            source: 'ONLINE' as const,
            createdBy: ownerUser.id,
          },
        });

        await prisma.appointmentItem.create({
          data: {
            appointmentId: apt.id,
            serviceId: service.id,
            employeeId: emp.id,
            startTime,
            endTime,
            priceSnapshot: service.price,
            durationSnapshot: service.durationMinutes,
            serviceNameSnapshot: service.name,
            commissionSnapshot: empSvc.commission,
          },
        });

        await prisma.appointmentStatusHistory.create({
          data: {
            appointmentId: apt.id,
            fromStatus: null,
            toStatus: status,
            changedBy: ownerUser.id,
            notes: 'Creada por seed',
          },
        });
      }
      console.log('  6 appointments created for Alfredo (4 completed, 1 confirmed, 1 pending).');
    }
  }

  console.log('  Tenant marketplace fields updated.');
  console.log('  Location GPS coordinates added.');

  // ─── DEMO REWARDS ──────────────────────────────────
  console.log('\nSeeding demo rewards...');

  const corteServiceId = serviceMap.get('Corte de Cabello');
  const existingRewards = await prisma.reward.count({ where: { tenantId: tenant.id } });

  if (existingRewards === 0) {
    await prisma.reward.create({
      data: {
        tenantId: tenant.id,
        name: 'Corte Gratis',
        description: 'Canjea tus puntos por un corte de cabello completamente gratis.',
        type: 'SERVICIO',
        pointsRequired: 500,
        serviceId: corteServiceId || null,
        isActive: true,
      },
    });

    await prisma.reward.create({
      data: {
        tenantId: tenant.id,
        name: '10% de Descuento',
        description: 'Obtén un 10% de descuento en cualquier servicio.',
        type: 'DESCUENTO',
        pointsRequired: 200,
        discountAmount: 10,
        discountMode: 'PERCENTAGE',
        isActive: true,
      },
    });

    console.log('  2 demo rewards created.');
  } else {
    console.log('  Rewards already exist, skipping.');
  }

  console.log('\nSeed completed successfully!');
  console.log('─────────────────────────────────────────────');
  console.log(`Tenant:        Demo Salon (slug: demo-salon)`);
  console.log(`Admin login:   admin@siliba.com / Admin123!`);
  console.log(`Staff logins:  maria@demo-salon.com / Staff123!`);
  console.log(`               james@demo-salon.com / Staff123!`);
  console.log(`               sofia@demo-salon.com / Staff123!`);
  console.log(`Invite code:   DEMOSALON`);
  console.log(`Super Admin:   super@siliba.com / Super123!`);
  console.log(`Marketplace:   cliente@siliba.com / Cliente123!`);
  console.log(`               alfredo@siliba.com / Cliente123!`);
  console.log('─────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
