import { Controller, Post, Req } from '@nestjs/common';
import { MetricsService } from '../../common/observability/metrics.service';
import type { Request } from 'express';
import { OrderService } from './order.service';

@Controller('payment/webhook')
export class WebhookController {
  constructor(
    private readonly orderService: OrderService,
    private readonly metricsService: MetricsService,
  ) {}

  @Post('paypal')
  async paypalWebhook(@Req() req: Request) {
    const body = req.body as
      | {
          event_type?: string;
          resource?: { id?: string; custom_id?: string; status?: string };
          orderId?: string;
          status?: string;
        }
      | undefined;
    const eventType = body?.event_type ?? '';
    const resourceStatus = body?.resource?.status ?? body?.status ?? '';
    const orderId = body?.resource?.custom_id ?? body?.orderId;
    if (!orderId) return { received: true };

    if (eventType.includes('COMPLETED') || resourceStatus === 'COMPLETED') {
      await this.orderService.markPaid(orderId);
      this.metricsService.trackPaymentSuccess();
    } else if (
      eventType.includes('DENIED') ||
      eventType.includes('FAILED') ||
      resourceStatus === 'DENIED' ||
      resourceStatus === 'FAILED'
    ) {
      await this.orderService.markFailed(orderId);
      this.metricsService.trackPaymentFailure();
    } else if (
      eventType.includes('VOIDED') ||
      eventType.includes('CANCELLED') ||
      resourceStatus === 'VOIDED' ||
      resourceStatus === 'CANCELLED'
    ) {
      await this.orderService.markCanceled(orderId);
    }
    return { received: true };
  }
}

