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
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { SetSchedulesDto } from './dto/schedule.dto';
import { CreateTimeOffDto, RejectTimeOffDto, SetServicesDto } from './dto/time-off.dto';
import { CreatePortfolioImageDto } from './dto/portfolio.dto';
import { CreateReviewDto } from './dto/review.dto';
import { UpdatePersonalInfoDto } from './dto/personal-info.dto';
import { CreateDocumentDto } from './dto/document.dto';
import { CreateTrainingDto } from './dto/training.dto';
import { DeactivateEmployeeDto } from './dto/deactivate-employee.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UploadsService } from '../uploads/uploads.service';
import { IsDateString, IsOptional, IsString } from 'class-validator';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

class EmployeeQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  includeInactive?: string;

  @IsOptional()
  @IsString()
  workingDate?: string; // YYYY-MM-DD — filter employees who work on this date
}

class TimeOffQueryDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  status?: string;
}

class EmployeeTimeOffQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly uploadsService: UploadsService,
  ) {}

  @Get()
  @RequirePermissions('employees.read')
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: EmployeeQueryDto,
  ) {
    return this.employeesService.findAll(tenantId, query, query.locationId, query.includeInactive === 'true', query.workingDate);
  }

  @Get('time-offs')
  @RequirePermissions('employees.read')
  async getAllTimeOffs(
    @CurrentTenant() tenantId: string,
    @Query() query: TimeOffQueryDto,
  ) {
    const timeOffs = await this.employeesService.getAllTimeOffs(
      tenantId,
      query.startDate,
      query.endDate,
      query.status,
    );
    return { data: timeOffs };
  }

  @Post()
  @RequirePermissions('employees.create')
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    const employee = await this.employeesService.create(tenantId, dto);
    return { data: employee };
  }

  @Get(':id/pending-appointments-count')
  @RequirePermissions('employees.delete')
  async getPendingAppointmentsCount(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const count = await this.employeesService.countPendingAppointments(id, tenantId);
    return { data: { count } };
  }

  @Post(':id/deactivate')
  @RequirePermissions('employees.delete')
  async deactivate(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: DeactivateEmployeeDto,
  ) {
    const result = await this.employeesService.deactivate(id, tenantId, dto, user.userId);
    return { data: result };
  }

  @Post(':id/finalize-deactivation')
  @RequirePermissions('employees.delete')
  async finalizeDeactivation(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.employeesService.finalizeDeactivation(id, tenantId, user.userId);
    return { data: result };
  }

  @Get(':id')
  @RequirePermissions('employees.read')
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const employee = await this.employeesService.findOne(id, tenantId);
    return { data: employee };
  }

  @Put(':id')
  @RequirePermissions('employees.update')
  async update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const employee = await this.employeesService.update(id, tenantId, dto);
    return { data: employee };
  }

  @Delete(':id')
  @RequirePermissions('employees.delete')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.employeesService.remove(id, tenantId);
    return { data: result };
  }

  @Get(':id/stats')
  @RequirePermissions('employees.read')
  async getStats(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const stats = await this.employeesService.getStats(id, tenantId);
    return { data: stats };
  }

  @Get(':id/schedules')
  @RequirePermissions('employees.read')
  async getSchedules(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const schedules = await this.employeesService.getSchedules(id, tenantId);
    return { data: schedules };
  }

  @Put(':id/schedules')
  @RequirePermissions('employees.manage_schedule')
  async setSchedules(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: SetSchedulesDto,
  ) {
    const schedules = await this.employeesService.setSchedules(id, tenantId, dto);
    return { data: schedules };
  }

  @Get(':id/time-off')
  @RequirePermissions('employees.read')
  async getTimeOff(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Query() query: EmployeeTimeOffQueryDto,
  ) {
    const timeOff = await this.employeesService.getTimeOff(id, tenantId, query.status);
    return { data: timeOff };
  }

  @Post(':id/time-off')
  @RequirePermissions('employees.manage_time_off')
  async addTimeOff(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateTimeOffDto,
  ) {
    const timeOff = await this.employeesService.addTimeOff(id, tenantId, dto);
    return { data: timeOff };
  }

  @Delete(':id/time-off/:timeOffId')
  @RequirePermissions('employees.manage_time_off')
  async removeTimeOff(
    @Param('id') id: string,
    @Param('timeOffId') timeOffId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.employeesService.removeTimeOff(id, tenantId, timeOffId);
    return { data: result };
  }

  @Put(':id/time-off/:timeOffId/approve')
  @RequirePermissions('employees.update')
  async approveTimeOff(
    @Param('id') id: string,
    @Param('timeOffId') timeOffId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const timeOff = await this.employeesService.approveTimeOff(tenantId, id, timeOffId, user.userId);
    return { data: timeOff };
  }

  @Put(':id/time-off/:timeOffId/reject')
  @RequirePermissions('employees.update')
  async rejectTimeOff(
    @Param('id') id: string,
    @Param('timeOffId') timeOffId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RejectTimeOffDto,
  ) {
    const timeOff = await this.employeesService.rejectTimeOff(tenantId, id, timeOffId, user.userId, dto.rejectionReason);
    return { data: timeOff };
  }

  @Get(':id/services')
  @RequirePermissions('employees.read')
  async getServices(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const services = await this.employeesService.getServices(id, tenantId);
    return { data: services };
  }

  @Put(':id/services')
  @RequirePermissions('employees.manage_services')
  async setServices(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: SetServicesDto,
  ) {
    const services = await this.employeesService.setServices(
      id,
      tenantId,
      dto.services,
    );
    return { data: services };
  }

  // ─── AVATAR ────────────────────────────────────────

  @Post(':id/avatar')
  @RequirePermissions('employees.update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAvatar(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: MulterFile,
  ) {
    const employee = await this.employeesService.findOne(id, tenantId);
    const oldAvatarUrl = employee.avatarUrl;
    const imageUrl = await this.uploadsService.saveFile(file, 'avatars');
    const updated = await this.employeesService.updateAvatar(id, tenantId, imageUrl);
    if (oldAvatarUrl) {
      await this.uploadsService.deleteFile(oldAvatarUrl);
    }
    return { data: updated };
  }

  // ─── PORTFOLIO ─────────────────────────────────────

  @Get(':id/portfolio')
  @RequirePermissions('employees.read')
  async getPortfolio(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const images = await this.employeesService.getPortfolio(id, tenantId);
    return { data: images };
  }

  @Post(':id/portfolio')
  @RequirePermissions('employees.update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async addPortfolioImage(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: MulterFile,
    @Body() dto: CreatePortfolioImageDto,
  ) {
    const imageUrl = await this.uploadsService.saveFile(file, 'portfolio');
    const image = await this.employeesService.addPortfolioImage(
      id,
      tenantId,
      imageUrl,
      dto.caption,
    );
    return { data: image };
  }

  @Delete(':id/portfolio/:imageId')
  @RequirePermissions('employees.update')
  async removePortfolioImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const image = await this.employeesService.removePortfolioImage(id, tenantId, imageId);
    await this.uploadsService.deleteFile(image.imageUrl);
    return { data: { message: 'Imagen eliminada' } };
  }

  // ─── REVIEWS ───────────────────────────────────────

  @Get(':id/reviews')
  @RequirePermissions('employees.read')
  async getReviews(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.employeesService.getReviews(id, tenantId);
    return { data: result };
  }

  @Post(':id/reviews')
  @RequirePermissions('employees.update')
  async createReview(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateReviewDto,
  ) {
    const review = await this.employeesService.createReview(id, tenantId, dto);
    return { data: review };
  }

  // ─── PERSONAL INFO ────────────────────────────────

  @Put(':id/personal-info')
  @RequirePermissions('employees.update')
  async updatePersonalInfo(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdatePersonalInfoDto,
  ) {
    const employee = await this.employeesService.updatePersonalInfo(id, tenantId, dto);
    return { data: employee };
  }

  // ─── DOCUMENTS ────────────────────────────────────

  @Get(':id/documents')
  @RequirePermissions('employees.read')
  async getDocuments(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const documents = await this.employeesService.getDocuments(id, tenantId);
    return { data: documents };
  }

  @Post(':id/documents')
  @RequirePermissions('employees.update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async addDocument(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: MulterFile,
    @Body() dto: CreateDocumentDto,
  ) {
    const fileUrl = await this.uploadsService.saveFile(file, 'documents');
    const result = await this.employeesService.addDocument(id, tenantId, fileUrl, dto);
    if (result.oldFileUrl) {
      await this.uploadsService.deleteFile(result.oldFileUrl);
    }
    return { data: result.document };
  }

  @Delete(':id/documents/:docId')
  @RequirePermissions('employees.update')
  async removeDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const doc = await this.employeesService.removeDocument(id, tenantId, docId);
    await this.uploadsService.deleteFile(doc.fileUrl);
    return { data: { message: 'Documento eliminado' } };
  }

  // ─── TRAININGS ────────────────────────────────────

  @Get(':id/trainings')
  @RequirePermissions('employees.read')
  async getTrainings(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const trainings = await this.employeesService.getTrainings(id, tenantId);
    return { data: trainings };
  }

  @Post(':id/trainings')
  @RequirePermissions('employees.update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async addTrainingWithFile(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: MulterFile,
    @Body() dto: CreateTrainingDto,
  ) {
    const fileUrl = file
      ? await this.uploadsService.saveFile(file, 'documents')
      : undefined;
    const training = await this.employeesService.addTraining(id, tenantId, dto, fileUrl);
    return { data: training };
  }

  @Delete(':id/trainings/:trainingId')
  @RequirePermissions('employees.update')
  async removeTraining(
    @Param('id') id: string,
    @Param('trainingId') trainingId: string,
    @CurrentTenant() tenantId: string,
  ) {
    const training = await this.employeesService.removeTraining(id, tenantId, trainingId);
    if (training.fileUrl) {
      await this.uploadsService.deleteFile(training.fileUrl);
    }
    return { data: { message: 'Formación eliminada' } };
  }

  // ─── ROLES ────────────────────────────────────────

  @Get(':id/roles')
  @RequirePermissions('employees.read')
  async getEmployeeRoles(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.employeesService.getEmployeeRoles(id, tenantId);
    return { data: result };
  }
}
