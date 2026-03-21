import { Module, Logger, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceJwtStrategy } from './strategies/marketplace-jwt.strategy';
import { TenantsModule } from '../tenants/tenants.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { StripeModule } from '../stripe/stripe.module';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    Logger.warn(
      'JWT_SECRET not set — using insecure default. Set JWT_SECRET for production.',
      'MarketplaceModule',
    );
    return 'zonadedamas-dev-secret-NOT-FOR-PRODUCTION';
  }
  return secret;
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'marketplace-jwt' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: {
          expiresIn: process.env.JWT_CLIENT_ACCESS_EXPIRY || '15m',
        },
      }),
    }),
    TenantsModule,
    forwardRef(() => AppointmentsModule),
    StripeModule,
  ],
  controllers: [MarketplaceController],
  providers: [MarketplaceService, MarketplaceJwtStrategy],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
