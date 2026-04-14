import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { IsString, IsOptional, MinLength } from 'class-validator';

class LogoutDto {
  @IsString()
  refreshToken: string;
}

class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto.email, dto.password);
    return { data: result };
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return { data: result };
  }

  @Public()
  @Post('social')
  async socialLogin(@Body() dto: SocialLoginDto) {
    const result = await this.authService.socialLogin(dto);
    return { data: result };
  }

  @Public()
  @Get('invite-preview/:code')
  async getInvitePreview(@Param('code') code: string) {
    return this.authService.getInvitePreview(code);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    const result = await this.authService.refresh(dto.refreshToken);
    return { data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: LogoutDto,
  ) {
    await this.authService.logout(dto.refreshToken);
    return { data: { message: 'Sesión cerrada exitosamente' } };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    const result = await this.authService.getMe(user.userId, user.tenantId);
    return { data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
    return { data: { message: 'Contraseña actualizada' } };
  }

  @UseGuards(JwtAuthGuard)
  @Post('register-as-professional')
  async registerAsProfessional(@CurrentUser() userPayload: JwtPayload) {
    const { userId, tenantId } = userPayload;

    const existing = await this.prisma.employee.findFirst({
      where: { userId, tenantId },
    });
    if (existing) {
      throw new ConflictException('Ya tienes un perfil de profesional');
    }

    const location = await this.prisma.location.findFirst({
      where: { tenantId, isActive: true },
    });
    if (!location) {
      throw new BadRequestException('No hay ubicaciones activas');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    const employee = await this.prisma.employee.create({
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        locationId: location.id,
        tenantId,
        userId,
        color: '#008080',
      },
    });

    // Auto-create default schedule: Mon-Sat 09:00-18:00
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
    await this.prisma.employeeSchedule.createMany({
      data: days.map((day) => ({
        employeeId: employee.id,
        dayOfWeek: day,
        isWorking: day !== 'SUNDAY',
        startTime: '09:00',
        endTime: '18:00',
        effectiveFrom: new Date('2020-01-01'),
      })),
    });

    return { data: employee };
  }
}
