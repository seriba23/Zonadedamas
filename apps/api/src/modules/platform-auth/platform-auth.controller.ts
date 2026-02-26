import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformJwtAuthGuard } from './guards/platform-jwt-auth.guard';
import { IsString, IsEmail } from 'class-validator';

class PlatformLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

class PlatformRefreshDto {
  @IsString()
  refreshToken: string;
}

class PlatformLogoutDto {
  @IsString()
  refreshToken: string;
}

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly authService: PlatformAuthService) {}

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  async login(@Body() dto: PlatformLoginDto) {
    const result = await this.authService.login(dto.email, dto.password);
    return { data: result };
  }

  @Post('refresh')
  async refresh(@Body() dto: PlatformRefreshDto) {
    const result = await this.authService.refresh(dto.refreshToken);
    return { data: result };
  }

  @UseGuards(PlatformJwtAuthGuard)
  @Post('logout')
  async logout(@Body() dto: PlatformLogoutDto) {
    await this.authService.logout(dto.refreshToken);
    return { data: { message: 'Sesión cerrada exitosamente' } };
  }

  @UseGuards(PlatformJwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: any) {
    const result = await this.authService.getMe(req.user.userId);
    return { data: result };
  }
}
