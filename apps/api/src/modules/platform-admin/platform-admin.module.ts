import { Module } from '@nestjs/common';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAuthModule } from '../platform-auth/platform-auth.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [PlatformAuthModule, EmployeesModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService],
})
export class PlatformAdminModule {}
