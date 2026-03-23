import { Module, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformJwtStrategy } from './strategies/platform-jwt.strategy';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    Logger.warn(
      'JWT_SECRET not set — using insecure default.',
      'PlatformAuthModule',
    );
    return 'siliba-dev-secret-NOT-FOR-PRODUCTION';
  }
  return secret;
}

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: {
          expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        },
      }),
    }),
  ],
  controllers: [PlatformAuthController],
  providers: [PlatformAuthService, PlatformJwtStrategy],
  exports: [PlatformAuthService],
})
export class PlatformAuthModule {}
