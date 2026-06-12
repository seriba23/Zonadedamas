import { Module } from '@nestjs/common';
import { StaffNotificationsController } from './staff-notifications.controller';
import { StaffNotificationsService } from './staff-notifications.service';
import { NotifyStaffService } from './notify-staff.service';
import { WebPushService } from './web-push.service';
import { StaffEventsListener } from './staff-events.listener';

@Module({
  controllers: [StaffNotificationsController],
  providers: [
    StaffNotificationsService,
    NotifyStaffService,
    WebPushService,
    StaffEventsListener,
  ],
  exports: [NotifyStaffService],
})
export class StaffNotificationsModule {}
