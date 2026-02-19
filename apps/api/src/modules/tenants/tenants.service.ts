import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateLocationDto, UpdateLocationDto } from './dto/create-location.dto';

// All 53 permissions for the platform
const ALL_PERMISSIONS = [
  // Tenant & Settings
  { module: 'tenant', action: 'read' },
  { module: 'tenant', action: 'update' },
  // Locations
  { module: 'locations', action: 'read' },
  { module: 'locations', action: 'create' },
  { module: 'locations', action: 'update' },
  { module: 'locations', action: 'delete' },
  // Users
  { module: 'users', action: 'read' },
  { module: 'users', action: 'create' },
  { module: 'users', action: 'update' },
  { module: 'users', action: 'delete' },
  { module: 'users', action: 'manage' },
  // Roles
  { module: 'roles', action: 'read' },
  { module: 'roles', action: 'create' },
  { module: 'roles', action: 'update' },
  { module: 'roles', action: 'delete' },
  // Clients
  { module: 'clients', action: 'read' },
  { module: 'clients', action: 'create' },
  { module: 'clients', action: 'update' },
  { module: 'clients', action: 'delete' },
  // Services
  { module: 'services', action: 'read' },
  { module: 'services', action: 'create' },
  { module: 'services', action: 'update' },
  { module: 'services', action: 'delete' },
  // Employees
  { module: 'employees', action: 'read' },
  { module: 'employees', action: 'create' },
  { module: 'employees', action: 'update' },
  { module: 'employees', action: 'delete' },
  { module: 'employees', action: 'manage_schedule' },
  { module: 'employees', action: 'manage_time_off' },
  { module: 'employees', action: 'manage_services' },
  // Resources
  { module: 'resources', action: 'read' },
  { module: 'resources', action: 'create' },
  { module: 'resources', action: 'update' },
  { module: 'resources', action: 'delete' },
  // Availability
  { module: 'availability', action: 'read' },
  // Appointments
  { module: 'appointments', action: 'read' },
  { module: 'appointments', action: 'create' },
  { module: 'appointments', action: 'update' },
  { module: 'appointments', action: 'delete' },
  { module: 'appointments', action: 'reschedule' },
  { module: 'appointments', action: 'cancel' },
  { module: 'appointments', action: 'complete' },
  { module: 'appointments', action: 'no_show' },
  // Payments
  { module: 'payments', action: 'read' },
  { module: 'payments', action: 'create' },
  { module: 'payments', action: 'refund' },
  { module: 'payments', action: 'void' },
  // Reports
  { module: 'reports', action: 'read' },
  { module: 'reports', action: 'export' },
  // Audit
  { module: 'audit', action: 'read' },
  // Automation
  { module: 'automation', action: 'read' },
  { module: 'automation', action: 'manage' },
];

// Default roles and their permissions
const DEFAULT_ROLES = [
  {
    name: 'Owner',
    description: 'Full access to everything',
    isSystem: true,
    permissions: ALL_PERMISSIONS.map((p) => `${p.module}.${p.action}`),
  },
  {
    name: 'Manager',
    description: 'Manages staff, services, and appointments',
    isSystem: true,
    permissions: [
      'locations.read', 'locations.update',
      'users.read', 'users.create', 'users.update', 'users.manage',
      'roles.read',
      'clients.read', 'clients.create', 'clients.update', 'clients.delete',
      'services.read', 'services.create', 'services.update',
      'employees.read', 'employees.create', 'employees.update',
      'employees.manage_schedule', 'employees.manage_time_off', 'employees.manage_services',
      'resources.read', 'resources.create', 'resources.update',
      'availability.read',
      'appointments.read', 'appointments.create', 'appointments.update',
      'appointments.reschedule', 'appointments.cancel', 'appointments.complete', 'appointments.no_show',
      'payments.read', 'payments.create', 'payments.refund',
      'reports.read', 'reports.export',
      'audit.read',
    ],
  },
  {
    name: 'Receptionist',
    description: 'Manages bookings and clients',
    isSystem: true,
    permissions: [
      'clients.read', 'clients.create', 'clients.update',
      'services.read',
      'employees.read',
      'availability.read',
      'appointments.read', 'appointments.create', 'appointments.update',
      'appointments.reschedule', 'appointments.cancel', 'appointments.complete', 'appointments.no_show',
      'payments.read', 'payments.create',
      'reports.read',
    ],
  },
  {
    name: 'Employee',
    description: 'Views own schedule and appointments',
    isSystem: true,
    permissions: [
      'clients.read',
      'services.read',
      'availability.read',
      'appointments.read', 'appointments.complete', 'appointments.no_show',
    ],
  },
  {
    name: 'Accountant',
    description: 'View and manage payments',
    isSystem: true,
    permissions: [
      'clients.read',
      'appointments.read',
      'payments.read', 'payments.create', 'payments.refund',
      'reports.read', 'reports.export',
    ],
  },
  {
    name: 'ReadOnly',
    description: 'View-only access',
    isSystem: true,
    permissions: [
      'clients.read', 'services.read', 'employees.read',
      'resources.read', 'availability.read', 'appointments.read',
      'payments.read', 'reports.read',
    ],
  },
  {
    name: 'Custom',
    description: 'Customizable role',
    isSystem: false,
    permissions: [],
  },
];

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async onboard(dto: CreateTenantDto) {
    return this.prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          email: dto.email,
          timezone: dto.timezone || 'UTC',
          currency: dto.currency || 'USD',
        },
      });

      // Upsert all 53 permissions (global, not tenant-specific)
      const permissionRecords: Record<string, { id: string }> = {};
      for (const perm of ALL_PERMISSIONS) {
        const record = await tx.permission.upsert({
          where: {
            module_action: { module: perm.module, action: perm.action },
          },
          update: {},
          create: {
            module: perm.module,
            action: perm.action,
            description: `${perm.action} access to ${perm.module}`,
          },
        });
        permissionRecords[`${perm.module}.${perm.action}`] = record;
      }

      // Create default roles with permission assignments
      const createdRoles: Record<string, { id: string }> = {};
      for (const roleDef of DEFAULT_ROLES) {
        const slug = roleDef.name.toLowerCase().replace(/\s+/g, '-');
        const role = await tx.role.create({
          data: {
            name: roleDef.name,
            slug,
            description: roleDef.description,
            isSystem: roleDef.isSystem,
            tenantId: tenant.id,
          },
        });

        if (roleDef.permissions.length > 0) {
          const permIds = roleDef.permissions
            .filter((p) => permissionRecords[p])
            .map((p) => ({ roleId: role.id, permissionId: permissionRecords[p].id }));

          if (permIds.length > 0) {
            await tx.rolePermission.createMany({ data: permIds });
          }
        }

        createdRoles[roleDef.name] = role;
      }

      // Create owner user
      const passwordHash = await bcrypt.hash(dto.owner.password, 12);
      const ownerUser = await tx.user.create({
        data: {
          email: dto.owner.email,
          passwordHash,
          firstName: dto.owner.firstName,
          lastName: dto.owner.lastName,
          tenantId: tenant.id,
          isActive: true,
        },
      });

      // Assign Owner role
      await tx.userRole.create({
        data: {
          userId: ownerUser.id,
          roleId: createdRoles['Owner'].id,
          tenantId: tenant.id,
        },
      });

      return {
        tenant,
        user: {
          id: ownerUser.id,
          email: ownerUser.email,
          firstName: ownerUser.firstName,
          lastName: ownerUser.lastName,
        },
      };
    });
  }

  async getCurrent(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            users: true,
            locations: true,
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  // Locations
  async createLocation(tenantId: string, dto: CreateLocationDto) {
    return this.prisma.location.create({
      data: {
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
        timezone: dto.timezone,
        tenantId,
        isActive: true,
      },
    });
  }

  async findAllLocations(tenantId: string) {
    return this.prisma.location.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async updateLocation(id: string, tenantId: string, dto: UpdateLocationDto) {
    const location = await this.prisma.location.findFirst({
      where: { id, tenantId },
    });
    if (!location) throw new NotFoundException('Location not found');

    return this.prisma.location.update({
      where: { id },
      data: dto,
    });
  }

  async deleteLocation(id: string, tenantId: string) {
    const location = await this.prisma.location.findFirst({
      where: { id, tenantId },
    });
    if (!location) throw new NotFoundException('Location not found');

    await this.prisma.location.delete({ where: { id } });
    return { message: 'Location deleted' };
  }
}
