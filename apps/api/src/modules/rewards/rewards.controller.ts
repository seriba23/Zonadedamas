import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { RewardsService } from './rewards.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';

@Controller('rewards')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get()
  @RequirePermissions('rewards.read')
  findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.rewardsService.findAll(req.user.tenantId, {
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('rewards.read')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.rewardsService.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermissions('rewards.create')
  create(@Request() req: any, @Body() dto: CreateRewardDto) {
    return this.rewardsService.create(
      req.user.tenantId,
      dto,
      req.user.userId,
    );
  }

  @Put(':id')
  @RequirePermissions('rewards.update')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateRewardDto,
  ) {
    return this.rewardsService.update(
      req.user.tenantId,
      id,
      dto,
      req.user.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('rewards.delete')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.rewardsService.remove(
      req.user.tenantId,
      id,
      req.user.userId,
    );
  }

  @Put('redemptions/:code/use')
  @RequirePermissions('rewards.update')
  markCouponUsed(@Request() req: any, @Param('code') code: string) {
    return this.rewardsService.markCouponUsed(
      req.user.tenantId,
      code,
      req.user.userId,
    );
  }
}
