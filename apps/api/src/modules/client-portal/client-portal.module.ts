import { Module, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ClientPortalController } from './client-portal.controller';
import { ClientPortalService } from './client-portal.service';
import { ClientJwtStrategy } from './strategies/client-jwt.strategy';
import { TenantsModule } from '../tenants/tenants.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AvailabilityModule } from '../availability/availability.module';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    Logger.warn(
      'JWT_SECRET not set — using insecure default. Set JWT_SECRET for production.',
      'ClientPortalModule',
    );
    return 'zonadedamas-dev-secret-NOT-FOR-PRODUCTION';
  }
  return secret;
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'client-jwt' }),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: {
          expiresIn: process.env.JWT_CLIENT_ACCESS_EXPIRY || '15m',
        },
      }),
    }),
    TenantsModule,
    AppointmentsModule,
    AvailabilityModule,
  ],
  controllers: [ClientPortalController],
  providers: [ClientPortalService, ClientJwtStrategy],
  exports: [ClientPortalService],
})
export class ClientPortalModule {}
