import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ServicesModule } from './modules/services/services.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AuditModule } from './modules/audit/audit.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { PublicBookingModule } from './modules/public-booking/public-booking.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { InviteCodesModule } from './modules/invite-codes/invite-codes.module';

import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    RedisModule,
    AuthModule,
    TenantsModule,
    RbacModule,
    ClientsModule,
    ServicesModule,
    EmployeesModule,
    ResourcesModule,
    AvailabilityModule,
    AppointmentsModule,
    PaymentsModule,
    AuditModule,
    EventsModule,
    HealthModule,
    PublicBookingModule,
    UploadsModule,
    InviteCodesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
