import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StaffNotificationsService } from './staff-notifications.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { SubscribePushDto } from './dto/subscribe-push.dto';

@Controller('staff-notifications')
@UseGuards(JwtAuthGuard)
export class StaffNotificationsController {
  constructor(private readonly service: StaffNotificationsService) {}

  @Get()
  list(@CurrentUser() user: any, @Query() filters: ListNotificationsDto) {
    return this.service.list(user.userId, filters);
  }

  @Get('unread-counts')
  unreadCounts(@CurrentUser() user: any) {
    return this.service.unreadCounts(user.userId);
  }

  @Get('vapid-public-key')
  vapidPublicKey() {
    return { data: { key: process.env.VAPID_PUBLIC_KEY ?? null } };
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.markRead(user.userId, id);
  }

  @Post('read-all')
  markAllRead(
    @CurrentUser() user: any,
    @Body() body: { section?: string },
  ) {
    return this.service.markAllRead(user.userId, body?.section);
  }

  @Post('push/subscribe')
  subscribePush(@CurrentUser() user: any, @Body() dto: SubscribePushDto) {
    return this.service.subscribePush(user.userId, dto);
  }

  @Post('push/unsubscribe')
  unsubscribePush(
    @CurrentUser() user: any,
    @Body() body: { endpoint: string },
  ) {
    return this.service.unsubscribePush(user.userId, body.endpoint);
  }
}
