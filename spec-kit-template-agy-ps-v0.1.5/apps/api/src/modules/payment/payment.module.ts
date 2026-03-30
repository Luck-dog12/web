import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { OrderService } from './order.service';
import { PaymentService } from './payment.service';
import { PaypalService } from './paypal.service';
import { WebhookController } from './webhook.controller';

@Module({
  controllers: [PaymentController, WebhookController],
  providers: [PaymentService, OrderService, PaypalService],
})
export class PaymentModule {}
