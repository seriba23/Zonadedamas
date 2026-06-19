import { Module } from '@nestjs/common';
import { CreatorCodesController } from './creator-codes.controller';
import { CreatorCodesService } from './creator-codes.service';
import { CreatorPayoutsService } from './creator-payouts.service';
import { PlatformAuthModule } from '../platform-auth/platform-auth.module';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [PlatformAuthModule, StripeModule],
  controllers: [CreatorCodesController],
  providers: [CreatorCodesService, CreatorPayoutsService],
  exports: [CreatorCodesService, CreatorPayoutsService],
})
export class CreatorCodesModule {}
