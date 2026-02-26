import { Module, Global } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PlanLimitsService } from './plan-limits.service';

@Global()
@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, PlanLimitsService],
  exports: [SubscriptionsService, PlanLimitsService],
})
export class SubscriptionsModule {}
