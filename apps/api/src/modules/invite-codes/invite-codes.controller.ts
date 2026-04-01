import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { InviteCodesService } from './invite-codes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { IsOptional, IsInt, Min, IsDateString, IsString, IsArray } from 'class-validator';

class CreateInviteCodeDto {
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsArray()
  serviceIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  maxUses?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

@Controller('invite-codes')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InviteCodesController {
  constructor(private readonly inviteCodesService: InviteCodesService) {}

  @Post()
  @RequirePermissions('tenant.update')
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateInviteCodeDto,
  ) {
    const result = await this.inviteCodesService.create(
      user.tenantId,
      dto.jobTitle,
      dto.serviceIds,
      dto.maxUses,
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    );
    return { data: result };
  }

  @Get()
  @RequirePermissions('tenant.update')
  async findAll(@CurrentUser() user: JwtPayload) {
    const result = await this.inviteCodesService.findAll(user.tenantId);
    return { data: result };
  }

  @Delete(':id')
  @RequirePermissions('tenant.update')
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.inviteCodesService.deactivate(id, user.tenantId);
    return { data: { message: 'Código desactivado' } };
  }
}
