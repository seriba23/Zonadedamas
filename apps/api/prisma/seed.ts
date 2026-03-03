import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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
];

// ─── ROLE PERMISSION MAPPING ─────────────────────────────────────────────────

type PermissionKey = `${string}.${string}`;

const permKey = (module: string, action: string): PermissionKey =>
  `${module}.${action}` as PermissionKey;

const ALL_PERMISSIONS: PermissionKey[] = PERMISSIONS.map((p) =>
  permKey(p.module, p.action)
);

// Permissions that the admin role does NOT get
const ADMIN_EXCLUDED: PermissionKey[] = [permKey('settings', 'billing')];

const MANAGER_PERMISSIONS: PermissionKey[] = [
  permKey('appointments', 'create'),
  permKey('appointments', 'read'),
  permKey('appointments', 'update'),
  permKey('appointments', 'cancel'),
  permKey('appointments', 'reschedule'),
  permKey('appointments', 'complete'),
  permKey('availability', 'read'),
  permKey('availability', 'manage'),
  permKey('clients', 'create'),
  permKey('clients', 'read'),
  permKey('clients', 'update'),
  permKey('clients', 'export'),
  permKey('services', 'read'),
  permKey('employees', 'read'),
  permKey('employees', 'manage_schedule'),
  permKey('employees', 'manage_time_off'),
  permKey('resources', 'read'),
  permKey('payments', 'create'),
  permKey('payments', 'read'),
  permKey('payments', 'refund'),
  permKey('payments', 'export'),
  permKey('reports', 'revenue'),
  permKey('reports', 'appointments'),
  permKey('reports', 'staff'),
  permKey('reports', 'clients'),
  permKey('automations', 'read'),
  permKey('notifications', 'manage'),
  permKey('locations', 'read'),
  permKey('users', 'read'),
  permKey('roles', 'read'),
  permKey('rewards', 'read'),
];

const FRONTDESK_PERMISSIONS: PermissionKey[] = [
  permKey('appointments', 'create'),
  permKey('appointments', 'read'),
  permKey('appointments', 'update'),
  permKey('appointments', 'cancel'),
  permKey('appointments', 'reschedule'),
  permKey('appointments', 'complete'),
  permKey('availability', 'read'),
  permKey('clients', 'create'),
  permKey('clients', 'read'),
  permKey('clients', 'update'),
  permKey('services', 'read'),
  permKey('employees', 'read'),
  permKey('resources', 'read'),
  permKey('payments', 'create'),
  permKey('payments', 'read'),
  permKey('locations', 'read'),
  permKey('rewards', 'read'),
];

const STAFF_PERMISSIONS: PermissionKey[] = [
  permKey('appointments', 'read'),
  permKey('appointments', 'complete'),
  permKey('availability', 'read'),
  permKey('clients', 'read'),
  permKey('services', 'read'),
  permKey('employees', 'read'),
];

const ACCOUNTANT_PERMISSIONS: PermissionKey[] = [
  permKey('payments', 'read'),
  permKey('payments', 'export'),
  permKey('reports', 'revenue'),
  permKey('reports', 'appointments'),
  permKey('reports', 'clients'),
  permKey('appointments', 'read'),
  permKey('clients', 'read'),
  permKey('locations', 'read'),
];

const READONLY_PERMISSIONS: PermissionKey[] = [
  permKey('appointments', 'read'),
  permKey('clients', 'read'),
  permKey('services', 'read'),
  permKey('employees', 'read'),
  permKey('payments', 'read'),
  permKey('reports', 'revenue'),
  permKey('reports', 'appointments'),
  permKey('locations', 'read'),
];

const ROLE_DEFINITIONS = [
  {
    name: 'Owner',
    slug: 'owner',
    description: 'Full access to all features including billing',
    isSystem: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'Admin',
    slug: 'admin',
    description: 'Full access except billing management',
    isSystem: true,
    permissions: ALL_PERMISSIONS.filter((p) => !ADMIN_EXCLUDED.includes(p)),
  },
  {
    name: 'Manager',
    slug: 'manager',
    description: 'Manages daily operations, staff, and reports',
    isSystem: true,
    permissions: MANAGER_PERMISSIONS,
  },
  {
    name: 'Front Desk',
    slug: 'frontdesk',
    description: 'Handles appointments, clients, and basic payments',
    isSystem: true,
    permissions: FRONTDESK_PERMISSIONS,
  },
  {
    name: 'Staff',
    slug: 'staff',
    description: 'View-only access to own appointments and clients',
    isSystem: true,
    permissions: STAFF_PERMISSIONS,
  },
  {
    name: 'Accountant',
    slug: 'accountant',
    description: 'Access to financial reports and payment data',
    isSystem: true,
    permissions: ACCOUNTANT_PERMISSIONS,
  },
  {
    name: 'Read Only',
    slug: 'readonly',
    description: 'View-only access to core data',
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
      settings: {},
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
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@zonadedamas.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@zonadedamas.com',
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
      bio: 'Estilista senior con 10 años de experiencia',
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
      bio: 'Especialista en coloración y tratamientos capilares',
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
      bio: 'Experta en cuidado de uñas y tratamientos faciales',
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
      notes: 'Prefers eco-friendly products',
    },
    {
      firstName: 'Michael',
      lastName: 'Brown',
      email: 'michael.brown@example.com',
      phone: '+1-555-0302',
      gender: 'male',
      notes: 'Regular monthly haircut',
    },
    {
      firstName: 'Sarah',
      lastName: 'Davis',
      email: 'sarah.davis@example.com',
      phone: '+1-555-0303',
      gender: 'female',
      notes: 'Allergic to certain hair dyes - check before coloring',
    },
    {
      firstName: 'David',
      lastName: 'Miller',
      email: 'david.miller@example.com',
      phone: '+1-555-0304',
      gender: 'male',
      notes: null,
    },
    {
      firstName: 'Jessica',
      lastName: 'Wilson',
      email: 'jessica.wilson@example.com',
      phone: '+1-555-0305',
      gender: 'female',
      notes: 'VIP client - priority booking',
    },
  ];

  for (const clientData of clientsData) {
    const existing = await prisma.client.findFirst({
      where: { tenantId: tenant.id, email: clientData.email },
    });

    if (!existing) {
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
    const existingMarchApts = await prisma.appointment.count({
      where: {
        tenantId: tenant.id,
        startTime: { gte: new Date('2026-03-01T00:00:00Z') },
        endTime: { lte: new Date('2026-03-31T23:59:59Z') },
      },
    });

    // If incomplete set exists, clean up first
    if (existingMarchApts > 0 && existingMarchApts < 30) {
      const oldApts = await prisma.appointment.findMany({
        where: {
          tenantId: tenant.id,
          startTime: { gte: new Date('2026-03-01T00:00:00Z') },
          endTime: { lte: new Date('2026-03-31T23:59:59Z') },
        },
        select: { id: true },
      });
      const oldIds = oldApts.map(a => a.id);
      await prisma.appointmentStatusHistory.deleteMany({ where: { appointmentId: { in: oldIds } } });
      await prisma.appointmentItem.deleteMany({ where: { appointmentId: { in: oldIds } } });
      await prisma.appointment.deleteMany({ where: { id: { in: oldIds } } });
      console.log(`  Cleaned ${oldIds.length} incomplete March appointments.`);
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
          // First 3 slots per employee → COMPLETED (past dates), rest alternate PENDING/CONFIRMED
          const status = i < 3 ? 'COMPLETED' as const : (i % 2 === 0 ? 'CONFIRMED' as const : 'PENDING' as const);

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
        'Excelente servicio, muy profesional.',
        'Me encanto el resultado, definitivamente volvere.',
        'Muy buena atencion, el lugar es muy agradable.',
        'Buen trabajo, aunque hubo un poco de espera.',
        'Increible experiencia, super recomendado.',
        'El mejor salon al que he ido, trato impecable.',
        'Muy satisfecha con el resultado final.',
        'Profesionales de primera, ambiente muy limpio.',
        'Excelente relacion calidad-precio.',
      ];
      const reviewRatings = [5, 5, 4, 3, 5, 5, 4, 5, 4];

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
    where: { email: 'super@zonadedamas.com' },
    update: {},
    create: {
      email: 'super@zonadedamas.com',
      passwordHash: superPasswordHash,
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
    },
  });
  console.log('  Platform admin: super@zonadedamas.com / Super123!');

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
    where: { email: 'cliente@zonadedamas.com' },
  });
  if (!existingMktUser) {
    await prisma.marketplaceUser.create({
      data: {
        email: 'cliente@zonadedamas.com',
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
    where: { email: 'alfredo@zonadedamas.com' },
  });
  let alfredoMktUser = existingAlfredo;
  if (!existingAlfredo) {
    alfredoMktUser = await prisma.marketplaceUser.create({
      data: {
        email: 'alfredo@zonadedamas.com',
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
      where: { tenantId: tenant.id, email: 'alfredo@zonadedamas.com' },
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
          email: 'alfredo@zonadedamas.com',
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
  console.log(`Admin login:   admin@zonadedamas.com / Admin123!`);
  console.log(`Staff logins:  maria@demo-salon.com / Staff123!`);
  console.log(`               james@demo-salon.com / Staff123!`);
  console.log(`               sofia@demo-salon.com / Staff123!`);
  console.log(`Invite code:   DEMOSALON`);
  console.log(`Super Admin:   super@zonadedamas.com / Super123!`);
  console.log(`Marketplace:   cliente@zonadedamas.com / Cliente123!`);
  console.log(`               alfredo@zonadedamas.com / Cliente123!`);
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
