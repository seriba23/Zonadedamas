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
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

@Controller('promotions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  @RequirePermissions('promotions.read')
  findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('type') type?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.promotionsService.findAll(req.user.tenantId, {
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
      type,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
    });
  }

  @Get(':id')
  @RequirePermissions('promotions.read')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.promotionsService.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermissions('promotions.create')
  create(@Request() req: any, @Body() dto: CreatePromotionDto) {
    return this.promotionsService.create(
      req.user.tenantId,
      dto,
      req.user.userId,
    );
  }

  @Put(':id')
  @RequirePermissions('promotions.update')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
  ) {
    return this.promotionsService.update(
      req.user.tenantId,
      id,
      dto,
      req.user.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('promotions.delete')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.promotionsService.remove(
      req.user.tenantId,
      id,
      req.user.userId,
    );
  }

  @Post('validate-code')
  @RequirePermissions('promotions.read')
  validateCode(@Request() req: any, @Body('code') code: string) {
    return this.promotionsService.validateCode(req.user.tenantId, code);
  }
}
