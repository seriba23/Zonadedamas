import { Module, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CreatorPortalController } from './creator-portal.controller';
import { CreatorPortalService } from './creator-portal.service';
import { CreatorJwtStrategy } from './strategies/creator-jwt.strategy';
import { CreatorCodesModule } from '../creator-codes/creator-codes.module';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    Logger.warn('JWT_SECRET not set — using insecure default.', 'CreatorPortalModule');
    return 'siliba-dev-secret-NOT-FOR-PRODUCTION';
  }
  return secret;
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'creator-jwt' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: { expiresIn: process.env.JWT_CREATOR_ACCESS_EXPIRY || '7d' },
      }),
    }),
    CreatorCodesModule,
  ],
  controllers: [CreatorPortalController],
  providers: [CreatorPortalService, CreatorJwtStrategy],
})
export class CreatorPortalModule {}
