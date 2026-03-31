import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleDto, CancelDto } from './dto/reschedule.dto';
import { FilterAppointmentsDto } from './dto/filter-appointments.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UploadsService } from '../uploads/uploads.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('appointments')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly uploadsService: UploadsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermissions('appointments.read')
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() filters: FilterAppointmentsDto,
  ) {
    return this.appointmentsService.findAll(tenantId, filters);
  }

  @Post()
  @RequirePermissions('appointments.create')
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(dto, tenantId, user.userId);
  }

  @Get(':id')
  @RequirePermissions('appointments.read')
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.findOne(id, tenantId);
  }

  @Put(':id')
  @RequirePermissions('appointments.update')
  async update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(id, dto, tenantId, user.userId);
  }

  @Post(':id/reschedule')
  @RequirePermissions('appointments.reschedule')
  async reschedule(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RescheduleDto,
  ) {
    return this.appointmentsService.reschedule(id, dto, tenantId, user.userId);
  }

  @Post(':id/cancel')
  @RequirePermissions('appointments.cancel')
  async cancel(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CancelDto,
  ) {
    return this.appointmentsService.cancel(id, dto, tenantId, user.userId);
  }

  @Post(':id/confirm')
  @RequirePermissions('appointments.update')
  async confirm(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.confirm(id, tenantId, user.userId);
  }

  @Post(':id/complete')
  @RequirePermissions('appointments.complete')
  async complete(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.complete(id, tenantId, user.userId);
  }

  @Post(':id/photo-consent')
  @RequirePermissions('appointments.complete')
  async setPhotoConsent(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { consent: boolean },
  ) {
    return this.appointmentsService.setPhotoConsent(id, tenantId, body.consent, user.userId);
  }

  @Post(':id/record-payment')
  @RequirePermissions('appointments.complete')
  async recordPayment(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { paymentMethod: string; amount?: number; notes?: string },
  ) {
    return this.appointmentsService.recordPayment(id, tenantId, body, user.userId);
  }

  @Post(':id/no-show')
  @RequirePermissions('appointments.update')
  async noShow(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.appointmentsService.noShow(id, tenantId, user.userId);
  }

  // ─── APPOINTMENT PHOTOS ──────────────────────────────

  @Get(':id/photos')
  @RequirePermissions('appointments.read')
  async getPhotos(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const photos = await this.prisma.appointmentPhoto.findMany({
      where: { appointmentId: id, tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return { data: photos };
  }

  @Post(':id/photos')
  @RequirePermissions('appointments.update')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Body('caption') caption?: string,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
    });
    if (!appointment) {
      throw new Error('Cita no encontrada');
    }

    const imageUrl = await this.uploadsService.saveFile(file, 'results');

    const photo = await this.prisma.appointmentPhoto.create({
      data: {
        tenantId,
        appointmentId: id,
        imageUrl,
        caption,
        uploadedById: user.userId,
      },
    });

    return { data: photo };
  }

  @Delete(':id/photos/:photoId')
  @RequirePermissions('appointments.update')
  async deletePhoto(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ) {
    const photo = await this.prisma.appointmentPhoto.findFirst({
      where: { id: photoId, appointmentId: id, tenantId },
    });

    if (!photo) {
      throw new Error('Foto no encontrada');
    }

    await this.uploadsService.deleteFile(photo.imageUrl);
    await this.prisma.appointmentPhoto.delete({ where: { id: photoId } });

    return { message: 'Foto eliminada' };
  }
}
