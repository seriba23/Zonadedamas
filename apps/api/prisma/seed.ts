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
      name: 'Haircut',
      description: 'Professional haircut and styling',
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 5,
      price: 25.0,
      color: '#6366f1',
      category: 'Hair',
      sortOrder: 1,
    },
    {
      name: 'Hair Color',
      description: 'Full hair coloring service with premium products',
      durationMinutes: 90,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 10,
      price: 80.0,
      color: '#8b5cf6',
      category: 'Hair',
      sortOrder: 2,
    },
    {
      name: 'Blowout',
      description: 'Wash, blow-dry, and style',
      durationMinutes: 45,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 5,
      price: 35.0,
      color: '#ec4899',
      category: 'Hair',
      sortOrder: 3,
    },
    {
      name: 'Manicure',
      description: 'Classic manicure with nail shaping and polish',
      durationMinutes: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 5,
      price: 20.0,
      color: '#f43f5e',
      category: 'Nails',
      sortOrder: 4,
    },
    {
      name: 'Facial',
      description: 'Deep cleansing facial treatment',
      durationMinutes: 60,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 10,
      price: 50.0,
      color: '#14b8a6',
      category: 'Skin Care',
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
      bio: 'Senior stylist with 10 years of experience',
      locationId: downtownLocation.id,
      services: [
        { name: 'Haircut', commission: 15.0 },
        { name: 'Hair Color', commission: 40.0 },
        { name: 'Blowout', commission: 20.0 },
      ],
    },
    {
      firstName: 'James',
      lastName: 'Wilson',
      email: 'james@demo-salon.com',
      phone: '+1-555-0202',
      color: '#10b981',
      bio: 'Specialist in hair coloring and treatments',
      locationId: downtownLocation.id,
      services: [
        { name: 'Haircut', commission: 15.0 },
        { name: 'Hair Color', commission: 40.0 },
      ],
    },
    {
      firstName: 'Sofia',
      lastName: 'Martinez',
      email: 'sofia@demo-salon.com',
      phone: '+1-555-0203',
      color: '#f59e0b',
      bio: 'Expert in nail care and facial treatments',
      locationId: mallLocation.id,
      services: [
        { name: 'Manicure', commission: 12.0 },
        { name: 'Facial', commission: 25.0 },
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

  console.log('\nSeed completed successfully!');
  console.log('─────────────────────────────────────────────');
  console.log(`Tenant:        Demo Salon (slug: demo-salon)`);
  console.log(`Admin login:   admin@zonadedamas.com / Admin123!`);
  console.log(`Staff logins:  maria@demo-salon.com / Staff123!`);
  console.log(`               james@demo-salon.com / Staff123!`);
  console.log(`               sofia@demo-salon.com / Staff123!`);
  console.log(`Invite code:   DEMOSALON`);
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
