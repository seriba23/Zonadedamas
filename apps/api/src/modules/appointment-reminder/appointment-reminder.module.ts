import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AppointmentReminderController } from './appointment-reminder.controller';
import { AppointmentReminderService } from './appointment-reminder.service';

@Module({
  imports: [PrismaModule],
  controllers: [AppointmentReminderController],
  providers: [AppointmentReminderService],
})
export class AppointmentReminderModule {}
