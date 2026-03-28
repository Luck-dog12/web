import { Injectable } from '@nestjs/common';
import { MetricsService } from '../../common/observability/metrics.service';
import { OrderService } from './order.service';

@Injectable()
export class PaymentService {
  constructor(
    private readonly orderService: OrderService,
    private readonly metricsService: MetricsService,
  ) {}

  async createCheckout(params: {
    userId: string;
    courseId: string;
    webBaseUrl: string;
    provider: 'paypal';
    currency: 'USD' | 'EUR';
  }) {
    const previousOrders = await this.orderService.listOrders(params.userId);
    if (previousOrders.some((order) => order.status === 'paid')) {
      this.metricsService.trackRepurchaseSignal();
    }
    return this.createPaypalCheckout(params);
  }

  private async createPaypalCheckout(params: {
    userId: string;
    courseId: string;
    webBaseUrl: string;
    currency: 'USD' | 'EUR';
  }) {
    const order = await this.orderService.createPendingOrder({
      userId: params.userId,
      courseId: params.courseId,
      provider: 'paypal',
      currency: params.currency,
    });
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_CLIENT_SECRET;
    const baseUrl = process.env.PAYPAL_BASE_URL ?? 'https://api-m.sandbox.paypal.com';
    if (!clientId || !secret) {
      await this.orderService.markPaid(order.id);
      return {
        orderId: order.id,
        redirectUrl: `${params.webBaseUrl}/checkout/success?courseId=${params.courseId}`,
      };
    }

    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenRes.ok || !tokenData.access_token) {
      return {
        orderId: order.id,
        redirectUrl: `${params.webBaseUrl}/checkout/cancel?courseId=${params.courseId}`,
      };
    }

    const createRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: order.id,
            amount: {
              currency_code: order.currency,
              value: (order.amountCents / 100).toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: `${params.webBaseUrl}/checkout/success?courseId=${params.courseId}`,
          cancel_url: `${params.webBaseUrl}/checkout/cancel?courseId=${params.courseId}`,
        },
      }),
    });
    const createData = (await createRes.json()) as {
      id?: string;
      links?: Array<{ rel?: string; href?: string }>;
    };
    if (!createRes.ok) {
      return {
        orderId: order.id,
        redirectUrl: `${params.webBaseUrl}/checkout/cancel?courseId=${params.courseId}`,
      };
    }

    if (createData.id) await this.orderService.attachProviderSession(order.id, createData.id);
    const approveLink = createData.links?.find((link) => link.rel === 'approve')?.href;
    return {
      orderId: order.id,
      redirectUrl: approveLink ?? `${params.webBaseUrl}/checkout/cancel?courseId=${params.courseId}`,
    };
  }

  async listOrders(userId: string) {
    return this.orderService.listOrders(userId);
  }
}
