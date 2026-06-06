import { Module } from '@nestjs/common';
import { ConfirmPaymentController } from './confirm-payment.controller';
import { ConfirmPaymentService } from './confirm-payment.service';

@Module({
  controllers: [ConfirmPaymentController],
  providers: [ConfirmPaymentService],
})
export class ConfirmPaymentModule {}
