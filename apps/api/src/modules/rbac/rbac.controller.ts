import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RbacService } from './rbac.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/create-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @RequirePermissions('roles.read')
  async findAllRoles(@CurrentTenant() tenantId: string) {
    const roles = await this.rbacService.findAllRoles(tenantId);
    return { data: roles };
  }

  @Post('roles')
  @RequirePermissions('roles.create')
  async createRole(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateRoleDto,
  ) {
    const role = await this.rbacService.createRole(tenantId, dto);
    return { data: role };
  }

  @Put('roles/:id')
  @RequirePermissions('roles.update')
  async updateRole(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const role = await this.rbacService.updateRole(id, tenantId, dto);
    return { data: role };
  }

  @Delete('roles/:id')
  @RequirePermissions('roles.delete')
  async deleteRole(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.rbacService.deleteRole(id, tenantId);
    return { data: result };
  }

  @Get('permissions')
  @RequirePermissions('roles.read')
  async findAllPermissions() {
    const permissions = await this.rbacService.findAllPermissions();
    return { data: permissions };
  }

  @Post('user-roles')
  @RequirePermissions('users.manage')
  async assignRole(
    @CurrentTenant() tenantId: string,
    @Body() dto: AssignRoleDto,
  ) {
    const result = await this.rbacService.assignRole(tenantId, dto);
    return { data: result };
  }

  @Delete('user-roles/:id')
  @RequirePermissions('users.manage')
  async removeRole(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.rbacService.removeRole(id, tenantId);
    return { data: result };
  }
}
