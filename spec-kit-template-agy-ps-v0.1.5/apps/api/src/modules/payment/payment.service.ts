import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { MetricsService } from '../../common/observability/metrics.service';
import { OrderService } from './order.service';
import { PaypalService } from './paypal.service';

type PaypalCreateOrderResponse = {
  id?: string;
  links?: Array<{ rel?: string; href?: string }>;
};

type PaypalCaptureOrderResponse = {
  status?: string;
  name?: string;
  message?: string;
  details?: Array<{ issue?: string; description?: string }>;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{ id?: string; status?: string }>;
    };
  }>;
};

type PaypalOrderDetailsResponse = PaypalCaptureOrderResponse;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly orderService: OrderService,
    private readonly metricsService: MetricsService,
    private readonly paypalService: PaypalService,
  ) {}

  getPublicConfig() {
    return {
      paypalClientId: this.paypalService.getClientId(),
    };
  }

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
    this.paypalService.assertCheckoutConfigured();

    const order = await this.orderService.createPendingOrder({
      userId: params.userId,
      courseId: params.courseId,
      provider: 'paypal',
      currency: params.currency,
    });

    const successUrl = this.buildCheckoutUrl({
      webBaseUrl: params.webBaseUrl,
      path: '/checkout/success',
      courseId: params.courseId,
      orderId: order.id,
    });
    const buyerCancelUrl = this.buildCheckoutUrl({
      webBaseUrl: params.webBaseUrl,
      path: '/checkout/cancel',
      courseId: params.courseId,
      orderId: order.id,
      reason: 'buyer_cancelled',
    });
    const systemErrorUrl = this.buildCheckoutUrl({
      webBaseUrl: params.webBaseUrl,
      path: '/checkout/cancel',
      courseId: params.courseId,
      orderId: order.id,
      reason: 'system_error',
    });

    let accessToken: string;
    try {
      accessToken = await this.paypalService.createAccessToken();
    } catch (error) {
      this.logger.error('Failed to create PayPal access token', {
        orderId: order.id,
        courseId: params.courseId,
        message: error instanceof Error ? error.message : String(error),
      });
      await this.failOrder(order.id);
      return {
        orderId: order.id,
        redirectUrl: systemErrorUrl,
      };
    }

    const createRes = await fetch(
      `${this.paypalService.getBaseUrl()}/v2/checkout/orders`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
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
            return_url: successUrl,
            cancel_url: buyerCancelUrl,
          },
        }),
      },
    );
    const createData = (await createRes
      .json()
      .catch(() => ({}))) as PaypalCreateOrderResponse;

    if (!createRes.ok || !createData.id) {
      this.logger.error('Failed to create PayPal checkout order', {
        orderId: order.id,
        courseId: params.courseId,
        status: createRes.status,
        response: createData,
      });
      await this.failOrder(order.id);
      return {
        orderId: order.id,
        redirectUrl: systemErrorUrl,
      };
    }

    await this.orderService.attachProviderSession(order.id, createData.id);
    const approveLink = createData.links?.find(
      (link) => link.rel === 'approve',
    )?.href;
    if (!approveLink) {
      this.logger.error('PayPal checkout response is missing approve link', {
        orderId: order.id,
        courseId: params.courseId,
        response: createData,
      });
      await this.failOrder(order.id);
      return {
        orderId: order.id,
        redirectUrl: systemErrorUrl,
      };
    }

    return {
      orderId: order.id,
      providerOrderId: createData.id,
      redirectUrl: approveLink,
    };
  }

  async captureCheckout(params: {
    userId: string;
    orderId: string;
    providerOrderId?: string;
  }) {
    const order = await this.orderService.getOrderForUser(
      params.orderId,
      params.userId,
    );
    if (order.provider !== 'paypal') {
      throw new BadRequestException('Unsupported payment provider');
    }

    if (order.status === 'paid') {
      return {
        orderId: order.id,
        courseId: order.courseId,
        status: 'paid' as const,
      };
    }
    if (order.status === 'canceled') {
      throw new BadRequestException('Checkout was canceled');
    }
    if (order.status === 'failed') {
      throw new BadRequestException('Checkout failed');
    }

    const providerOrderId = params.providerOrderId ?? order.providerSessionId;
    if (!providerOrderId) {
      throw new BadRequestException('Missing PayPal order id');
    }
    if (
      order.providerSessionId &&
      order.providerSessionId !== providerOrderId
    ) {
      throw new BadRequestException('PayPal order does not match checkout');
    }
    if (!order.providerSessionId) {
      await this.orderService.attachProviderSession(order.id, providerOrderId);
    }

    const accessToken = await this.paypalService.createAccessToken();
    const captureRes = await fetch(
      `${this.paypalService.getBaseUrl()}/v2/checkout/orders/${providerOrderId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const captureData = (await captureRes
      .json()
      .catch(() => ({}))) as PaypalCaptureOrderResponse;

    if (
      this.isSuccessfulCapture(captureData) ||
      captureData.details?.some(
        (detail) => detail.issue === 'ORDER_ALREADY_CAPTURED',
      )
    ) {
      const changed = await this.orderService.markPaid(order.id);
      if (changed) this.metricsService.trackPaymentSuccess();
      return {
        orderId: order.id,
        courseId: order.courseId,
        status: 'paid' as const,
      };
    }

    const providerState = this.getProviderState(captureData);
    if (this.isCanceledProviderState(providerState)) {
      await this.orderService.markCanceled(order.id);
      throw new BadRequestException('PayPal checkout was canceled');
    }
    if (this.isFailedProviderState(providerState)) {
      const changed = await this.orderService.markFailed(order.id);
      if (changed) this.metricsService.trackPaymentFailure();
      throw new BadRequestException(
        this.getProviderMessage(captureData, 'PayPal payment was declined'),
      );
    }
    if (!captureRes.ok) {
      throw new BadGatewayException(
        this.getProviderMessage(
          captureData,
          'Failed to confirm PayPal payment',
        ),
      );
    }

    throw new BadGatewayException(
      'PayPal payment is still pending confirmation',
    );
  }

  async cancelCheckout(params: {
    userId: string;
    orderId: string;
    providerOrderId?: string;
  }) {
    const order = await this.orderService.getOrderForUser(
      params.orderId,
      params.userId,
    );
    if (order.provider !== 'paypal') {
      throw new BadRequestException('Unsupported payment provider');
    }
    if (
      params.providerOrderId &&
      order.providerSessionId &&
      order.providerSessionId !== params.providerOrderId
    ) {
      throw new BadRequestException('PayPal order does not match checkout');
    }

    const providerOrderId = params.providerOrderId ?? order.providerSessionId;
    if (providerOrderId) {
      const reconciledStatus = await this.reconcilePaypalOrderStatus(
        order.id,
        providerOrderId,
      );
      if (reconciledStatus === 'unavailable') {
        return {
          orderId: order.id,
          courseId: order.courseId,
          status: order.status,
        };
      }
      if (reconciledStatus !== 'pending') {
        return {
          orderId: order.id,
          courseId: order.courseId,
          status: reconciledStatus,
        };
      }
    }

    if (order.status === 'pending') {
      await this.orderService.markCanceled(order.id);
      return {
        orderId: order.id,
        courseId: order.courseId,
        status: 'canceled' as const,
      };
    }

    return {
      orderId: order.id,
      courseId: order.courseId,
      status: order.status,
    };
  }

  async listOrders(userId: string) {
    return this.orderService.listOrders(userId);
  }

  private buildCheckoutUrl(params: {
    webBaseUrl: string;
    path: '/checkout/success' | '/checkout/cancel';
    courseId: string;
    orderId: string;
    reason?: 'buyer_cancelled' | 'system_error';
  }) {
    const url = new URL(params.path, params.webBaseUrl);
    url.searchParams.set('courseId', params.courseId);
    url.searchParams.set('orderId', params.orderId);
    if (params.reason) url.searchParams.set('reason', params.reason);
    return url.toString();
  }

  private async failOrder(orderId: string) {
    const changed = await this.orderService.markFailed(orderId);
    if (changed) this.metricsService.trackPaymentFailure();
  }

  private isSuccessfulCapture(response: PaypalCaptureOrderResponse) {
    if (response.status === 'COMPLETED') return true;
    return (
      response.purchase_units?.some((unit) =>
        unit.payments?.captures?.some(
          (capture) => capture.status === 'COMPLETED',
        ),
      ) ?? false
    );
  }

  private async reconcilePaypalOrderStatus(
    orderId: string,
    providerOrderId: string,
  ) {
    try {
      const orderDetails =
        await this.paypalService.getOrderDetails(providerOrderId);
      if (this.isSuccessfulCapture(orderDetails)) {
        const changed = await this.orderService.markPaid(orderId);
        if (changed) this.metricsService.trackPaymentSuccess();
        return 'paid' as const;
      }

      const providerState = this.getProviderState(orderDetails);
      if (this.isFailedProviderState(providerState)) {
        const changed = await this.orderService.markFailed(orderId);
        if (changed) this.metricsService.trackPaymentFailure();
        return 'failed' as const;
      }
      if (this.isCanceledProviderState(providerState)) {
        await this.orderService.markCanceled(orderId);
        return 'canceled' as const;
      }
    } catch {
      return 'unavailable' as const;
    }

    return 'pending' as const;
  }

  private getProviderState(
    response: PaypalCaptureOrderResponse | PaypalOrderDetailsResponse,
  ) {
    return (
      response.status ??
      response.details?.map((detail) => detail.issue).find(Boolean) ??
      response.name ??
      ''
    ).toUpperCase();
  }

  private getProviderMessage(
    response: PaypalCaptureOrderResponse,
    fallback: string,
  ) {
    return response.details?.[0]?.description ?? response.message ?? fallback;
  }

  private isCanceledProviderState(state: string) {
    return state.includes('VOID') || state.includes('CANCEL');
  }

  private isFailedProviderState(state: string) {
    return (
      state.includes('DENIED') ||
      state.includes('FAILED') ||
      state.includes('DECLINED') ||
      state.includes('REFUSED')
    );
  }
}
