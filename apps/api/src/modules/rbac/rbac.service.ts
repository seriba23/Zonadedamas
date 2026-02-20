import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/create-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPermissions(
    userId: string,
    tenantId: string,
  ): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId, tenantId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const permissionsSet = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionsSet.add(`${rp.permission.module}.${rp.permission.action}`);
      }
    }

    return Array.from(permissionsSet);
  }

  async hasPermission(
    userId: string,
    tenantId: string,
    permission: string,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, tenantId);
    return permissions.includes(permission);
  }

  async findAllRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { userRoles: true } },
      },
    });
  }

  async findAllPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    // Group by module
    const grouped = permissions.reduce(
      (acc, perm) => {
        if (!acc[perm.module]) {
          acc[perm.module] = [];
        }
        acc[perm.module].push(perm);
        return acc;
      },
      {} as Record<string, typeof permissions>,
    );

    return grouped;
  }

  async createRole(tenantId: string, dto: CreateRoleDto) {
    const slug = dto.name.toLowerCase().replace(/\s+/g, '-');
    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        tenantId,
        isSystem: false,
        rolePermissions: dto.permissionIds?.length
          ? {
              create: dto.permissionIds.map((permId) => ({
                permissionId: permId,
              })),
            }
          : undefined,
      },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
    return role;
  }

  async updateRole(id: string, tenantId: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
    });

    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (role.isSystem) {
      throw new BadRequestException('No se pueden modificar los roles del sistema');
    }

    // Update permissions if provided
    if (dto.permissionIds !== undefined) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
      if (dto.permissionIds.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: dto.permissionIds.map((permId) => ({
            roleId: id,
            permissionId: permId,
          })),
        });
      }
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
  }

  async deleteRole(id: string, tenantId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
    });

    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    if (role.isSystem) {
      throw new BadRequestException('No se pueden eliminar los roles del sistema');
    }

    await this.prisma.role.delete({ where: { id } });
    return { message: 'Rol eliminado' };
  }

  async assignRole(tenantId: string, dto: AssignRoleDto) {
    // Verify role belongs to tenant
    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, tenantId },
    });
    if (!role) throw new NotFoundException('Rol no encontrado');

    // Verify user belongs to tenant
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Check not already assigned
    const existing = await this.prisma.userRole.findFirst({
      where: { userId: dto.userId, roleId: dto.roleId },
    });
    if (existing) throw new BadRequestException('El rol ya está asignado');

    return this.prisma.userRole.create({
      data: { userId: dto.userId, roleId: dto.roleId, tenantId },
    });
  }

  async removeRole(userRoleId: string, tenantId: string) {
    const userRole = await this.prisma.userRole.findFirst({
      where: { id: userRoleId, role: { tenantId } },
    });
    if (!userRole) throw new NotFoundException('Asignación de rol no encontrada');

    await this.prisma.userRole.delete({ where: { id: userRoleId } });
    return { message: 'Rol eliminado' };
  }
}
