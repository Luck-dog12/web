import { Module } from '@nestjs/common';
import { EntitlementModule } from '../entitlement/entitlement.module';
import { PaymentController } from './payment.controller';
import { OrderService } from './order.service';
import { PaymentService } from './payment.service';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [EntitlementModule],
  controllers: [PaymentController, WebhookController],
  providers: [PaymentService, OrderService],
})
export class PaymentModule {}
