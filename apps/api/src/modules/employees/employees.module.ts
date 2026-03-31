import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { AvailabilityModule } from '../availability/availability.module';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [AvailabilityModule, StripeModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
