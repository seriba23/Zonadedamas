import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateLocationDto, UpdateLocationDto } from './dto/create-location.dto';
import { SetBusinessHoursDto } from './dto/business-hours.dto';
import { CreateBusinessClosureDto } from './dto/business-closure.dto';
import { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';

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

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        timezone: true,
        currency: true,
      },
    });
    if (!tenant) throw new NotFoundException('Negocio no encontrado');
    return tenant;
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
    if (!tenant) throw new NotFoundException('Negocio no encontrado');
    return tenant;
  }

  async updateProfile(tenantId: string, dto: UpdateTenantProfileDto) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.businessType !== undefined && { businessType: dto.businessType }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.businessPhone !== undefined && { businessPhone: dto.businessPhone }),
        ...(dto.isMarketplaceListed !== undefined && { isMarketplaceListed: dto.isMarketplaceListed }),
      },
    });
  }

  async updateLogo(tenantId: string, imageUrl: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logoUrl: true },
    });
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl: imageUrl },
    });
    return tenant?.logoUrl || null;
  }

  async updateCover(tenantId: string, imageUrl: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { coverImageUrl: true },
    });
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { coverImageUrl: imageUrl },
    });
    return tenant?.coverImageUrl || null;
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
    if (!location) throw new NotFoundException('Ubicación no encontrada');

    return this.prisma.location.update({
      where: { id },
      data: dto,
    });
  }

  async deleteLocation(id: string, tenantId: string) {
    const location = await this.prisma.location.findFirst({
      where: { id, tenantId },
    });
    if (!location) throw new NotFoundException('Ubicación no encontrada');

    // Soft delete to preserve related data (employees, appointments)
    await this.prisma.location.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Ubicación eliminada' };
  }

  // Business Hours
  private readonly DEFAULT_BUSINESS_HOURS = [
    { dayOfWeek: 'MONDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'TUESDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'WEDNESDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'THURSDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'FRIDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'SATURDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: true },
    { dayOfWeek: 'SUNDAY' as const, openTime: '09:00', closeTime: '18:00', isOpen: false },
  ];

  async getBusinessHours(tenantId: string) {
    const existing = await this.prisma.businessHours.findMany({
      where: { tenantId },
      orderBy: { dayOfWeek: 'asc' },
    });

    // Fill missing days with defaults
    const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const existingMap = new Map(existing.map((h) => [h.dayOfWeek, h]));

    return dayOrder.map((day) => {
      const found = existingMap.get(day as any);
      if (found) return found;
      const def = this.DEFAULT_BUSINESS_HOURS.find((d) => d.dayOfWeek === day)!;
      return { id: null, tenantId, ...def };
    });
  }

  async setBusinessHours(tenantId: string, dto: SetBusinessHoursDto) {
    await this.prisma.$transaction(async (tx) => {
      await tx.businessHours.deleteMany({ where: { tenantId } });
      await tx.businessHours.createMany({
        data: dto.hours.map((h) => ({
          tenantId,
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          isOpen: h.isOpen,
        })),
      });
    });
    return this.getBusinessHours(tenantId);
  }

  // Business Closures
  async getClosures(tenantId: string, startDate?: string, endDate?: string) {
    const where: any = { tenantId };
    if (startDate && endDate) {
      where.startDate = { lte: new Date(endDate + 'T23:59:59Z') };
      where.endDate = { gte: new Date(startDate + 'T00:00:00Z') };
    }
    return this.prisma.businessClosure.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });
  }

  async createClosure(tenantId: string, dto: CreateBusinessClosureDto) {
    const start = new Date(dto.startDate + 'T00:00:00Z');
    const end = new Date(dto.endDate + 'T00:00:00Z');
    if (start > end) {
      throw new BadRequestException('La fecha de inicio debe ser anterior o igual a la fecha de fin');
    }
    return this.prisma.businessClosure.create({
      data: {
        tenantId,
        startDate: start,
        endDate: end,
        reason: dto.reason,
      },
    });
  }

  async deleteClosure(id: string, tenantId: string) {
    const closure = await this.prisma.businessClosure.findFirst({
      where: { id, tenantId },
    });
    if (!closure) throw new NotFoundException('Cierre no encontrado');
    await this.prisma.businessClosure.delete({ where: { id } });
    return { message: 'Cierre eliminado' };
  }

  // Gallery
  async getGallery(tenantId: string) {
    return this.prisma.tenantGalleryImage.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async addGalleryImage(tenantId: string, imageUrl: string, caption?: string) {
    const count = await this.prisma.tenantGalleryImage.count({ where: { tenantId } });
    if (count >= 10) {
      throw new BadRequestException('Máximo 10 fotos en la galería');
    }
    return this.prisma.tenantGalleryImage.create({
      data: { tenantId, imageUrl, caption, sortOrder: count },
    });
  }

  async removeGalleryImage(tenantId: string, imageId: string) {
    const image = await this.prisma.tenantGalleryImage.findFirst({
      where: { id: imageId, tenantId },
    });
    if (!image) throw new NotFoundException('Imagen no encontrada');
    await this.prisma.tenantGalleryImage.delete({ where: { id: imageId } });
    return image;
  }
}
