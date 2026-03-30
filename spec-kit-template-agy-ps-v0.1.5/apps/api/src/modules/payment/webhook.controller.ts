import { Controller, Post, Req } from '@nestjs/common';
import { MetricsService } from '../../common/observability/metrics.service';
import type { Request } from 'express';
import { OrderService } from './order.service';
import { PaypalService } from './paypal.service';

type PaypalWebhookBody = {
  event_type?: string;
  resource?: {
    id?: string;
    custom_id?: string;
    status?: string;
    purchase_units?: Array<{ custom_id?: string }>;
    supplementary_data?: {
      related_ids?: { order_id?: string };
    };
  };
};

@Controller('payment/webhook')
export class WebhookController {
  constructor(
    private readonly orderService: OrderService,
    private readonly metricsService: MetricsService,
    private readonly paypalService: PaypalService,
  ) {}

  @Post('paypal')
  async paypalWebhook(@Req() req: Request) {
    const body = (req.body ?? {}) as PaypalWebhookBody;
    await this.paypalService.verifyWebhookSignature(req.headers, body);

    const eventType = body?.event_type ?? '';
    const resourceStatus = body?.resource?.status ?? '';
    const providerOrderId =
      body?.resource?.supplementary_data?.related_ids?.order_id ??
      (eventType.startsWith('CHECKOUT.ORDER.') ? body?.resource?.id : undefined);

    let orderId =
      body?.resource?.custom_id ?? body?.resource?.purchase_units?.[0]?.custom_id;
    if (!orderId && providerOrderId) {
      orderId = await this.orderService.findOrderIdByProviderSessionId(providerOrderId);
    }
    if (!orderId) return { received: true };

    if (providerOrderId) {
      const matches = await this.orderService.matchesProviderSession(orderId, providerOrderId);
      if (!matches) return { received: true };
    }

    if (eventType.includes('COMPLETED') || resourceStatus === 'COMPLETED') {
      const changed = await this.orderService.markPaid(orderId);
      if (changed) this.metricsService.trackPaymentSuccess();
    } else if (
      eventType.includes('DENIED') ||
      eventType.includes('FAILED') ||
      eventType.includes('DECLINED') ||
      resourceStatus === 'DENIED' ||
      resourceStatus === 'FAILED' ||
      resourceStatus === 'DECLINED'
    ) {
      const changed = await this.orderService.markFailed(orderId);
      if (changed) this.metricsService.trackPaymentFailure();
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

