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
import { IsString, IsUUID } from 'class-validator';

class GiftRewardDto {
  @IsUUID()
  rewardId: string;

  @IsUUID()
  clientId: string;
}
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

  @Post('gift')
  @RequirePermissions('rewards.create')
  giftReward(@Request() req: any, @Body() dto: GiftRewardDto) {
    return this.rewardsService.giftReward(
      req.user.tenantId,
      dto.rewardId,
      dto.clientId,
      req.user.userId,
    );
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

  // Valida un codigo publico de cupon (no consumio puntos del cliente).
  // Sirve para que el POS lo verifique antes de aplicarlo en una cita.
  @Post('validate-code')
  @RequirePermissions('rewards.read')
  validateCode(@Request() req: any, @Body() body: { code: string }) {
    return this.rewardsService.validateCode(req.user.tenantId, body?.code);
  }

  // Retira un cupón emitido (RewardRedemption). Solo si NO está USED.
  // Si fue canje con puntos, devuelve los puntos al cliente. Si fue regalo,
  // simplemente se elimina. Audit logueado.
  @Delete('redemptions/:id')
  @RequirePermissions('rewards.delete')
  removeRedemption(@Request() req: any, @Param('id') id: string) {
    return this.rewardsService.removeRedemption(
      req.user.tenantId,
      id,
      req.user.userId,
    );
  }

  // Historial completo de cupones del tenant (RewardRedemptions) con filtros
  // para el dashboard de admin: status, origen (regalo vs canje), rangos de
  // fecha (creacion / expiracion), cliente, reward, y busqueda libre.
  @Get('redemptions/all')
  @RequirePermissions('rewards.read')
  listRedemptions(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('expiresFrom') expiresFrom?: string,
    @Query('expiresTo') expiresTo?: string,
    @Query('createdFrom') createdFrom?: string,
    @Query('createdTo') createdTo?: string,
    @Query('clientId') clientId?: string,
    @Query('rewardId') rewardId?: string,
    @Query('search') search?: string,
  ) {
    return this.rewardsService.listRedemptions(req.user.tenantId, {
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      status,
      source: source === 'GIFT' || source === 'REDEEM' ? source : undefined,
      expiresFrom,
      expiresTo,
      createdFrom,
      createdTo,
      clientId,
      rewardId,
      search,
    });
  }

}
