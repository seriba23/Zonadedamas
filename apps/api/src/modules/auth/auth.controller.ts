import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { IsString } from 'class-validator';

class LogoutDto {
  @IsString()
  refreshToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
}
