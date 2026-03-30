import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { MetricsService } from '../../common/observability/metrics.service';
import { OrderService } from './order.service';
import { PaymentService } from './payment.service';
import { PaypalService } from './paypal.service';

describe('PaymentService', () => {
  let orderService: jest.Mocked<OrderService>;
  let metricsService: jest.Mocked<MetricsService>;
  let paypalService: jest.Mocked<PaypalService>;
  let service: PaymentService;

  beforeEach(() => {
    orderService = {
      attachProviderSession: jest.fn(),
      createPendingOrder: jest.fn(),
      findOrderIdByProviderSessionId: jest.fn(),
      getOrderForUser: jest.fn(),
      listOrders: jest.fn(),
      markCanceled: jest.fn(),
      markFailed: jest.fn(),
      markPaid: jest.fn(),
      matchesProviderSession: jest.fn(),
    } as unknown as jest.Mocked<OrderService>;

    metricsService = {
      trackPaymentFailure: jest.fn(),
      trackPaymentSuccess: jest.fn(),
      trackRepurchaseSignal: jest.fn(),
    } as unknown as jest.Mocked<MetricsService>;

    paypalService = {
      assertCheckoutConfigured: jest.fn(),
      createAccessToken: jest.fn(),
      getClientId: jest.fn().mockReturnValue('paypal-client-id'),
      getBaseUrl: jest.fn().mockReturnValue('https://api-m.sandbox.paypal.com'),
      getOrderDetails: jest.fn(),
    } as unknown as jest.Mocked<PaypalService>;

    service = new PaymentService(orderService, metricsService, paypalService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('marks the local order failed when PayPal order creation cannot start', async () => {
    orderService.listOrders.mockResolvedValue([]);
    orderService.createPendingOrder.mockResolvedValue({
      id: 'order-1',
      courseId: 'course-1',
      amountCents: 1200,
      currency: 'USD',
      status: 'pending',
    });
    orderService.markFailed.mockResolvedValue(true);
    paypalService.createAccessToken.mockRejectedValue(
      new Error('PayPal unavailable'),
    );

    const result = await service.createCheckout({
      userId: 'user-1',
      courseId: 'course-1',
      webBaseUrl: 'https://example.com',
      provider: 'paypal',
      currency: 'USD',
    });

    expect(orderService.markFailed).toHaveBeenCalledWith('order-1');
    expect(metricsService.trackPaymentFailure).toHaveBeenCalledTimes(1);
    expect(result.redirectUrl).toContain('/checkout/cancel');
    expect(result.redirectUrl).toContain('reason=system_error');
  });

  it('captures a pending PayPal order and marks it paid', async () => {
    orderService.getOrderForUser.mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      courseId: 'course-1',
      provider: 'paypal',
      providerSessionId: 'PAYPAL-ORDER-123',
      status: 'pending',
    });
    orderService.markPaid.mockResolvedValue(true);
    paypalService.createAccessToken.mockResolvedValue('paypal-access-token');

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                captures: [{ id: 'CAPTURE-123', status: 'COMPLETED' }],
              },
            },
          ],
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    ) as typeof fetch;

    try {
      const result = await service.captureCheckout({
        userId: 'user-1',
        orderId: 'order-1',
        providerOrderId: 'PAYPAL-ORDER-123',
      });

      expect(orderService.markPaid).toHaveBeenCalledWith('order-1');
      expect(metricsService.trackPaymentSuccess).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        orderId: 'order-1',
        courseId: 'course-1',
        status: 'paid',
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('marks terminal provider failures as failed', async () => {
    orderService.getOrderForUser.mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      courseId: 'course-1',
      provider: 'paypal',
      providerSessionId: 'PAYPAL-ORDER-123',
      status: 'pending',
    });
    orderService.markFailed.mockResolvedValue(true);
    paypalService.createAccessToken.mockResolvedValue('paypal-access-token');

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'DECLINED',
          details: [
            { issue: 'INSTRUMENT_DECLINED', description: 'Card declined' },
          ],
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    ) as typeof fetch;

    try {
      await expect(
        service.captureCheckout({
          userId: 'user-1',
          orderId: 'order-1',
          providerOrderId: 'PAYPAL-ORDER-123',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(orderService.markFailed).toHaveBeenCalledWith('order-1');
      expect(metricsService.trackPaymentFailure).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('keeps the order pending for non-terminal PayPal capture errors', async () => {
    orderService.getOrderForUser.mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      courseId: 'course-1',
      provider: 'paypal',
      providerSessionId: 'PAYPAL-ORDER-123',
      status: 'pending',
    });
    paypalService.createAccessToken.mockResolvedValue('paypal-access-token');

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'PAYER_ACTION_REQUIRED',
          message: 'Buyer still needs to approve the payment',
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    ) as typeof fetch;

    try {
      await expect(
        service.captureCheckout({
          userId: 'user-1',
          orderId: 'order-1',
          providerOrderId: 'PAYPAL-ORDER-123',
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);

      expect(orderService.markFailed).not.toHaveBeenCalled();
      expect(orderService.markCanceled).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('reconciles cancel requests against a completed PayPal order', async () => {
    orderService.getOrderForUser.mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      courseId: 'course-1',
      provider: 'paypal',
      providerSessionId: 'PAYPAL-ORDER-123',
      status: 'pending',
    });
    orderService.markPaid.mockResolvedValue(true);
    paypalService.getOrderDetails.mockResolvedValue({
      status: 'COMPLETED',
    });

    const result = await service.cancelCheckout({
      userId: 'user-1',
      orderId: 'order-1',
      providerOrderId: 'PAYPAL-ORDER-123',
    });

    expect(orderService.markPaid).toHaveBeenCalledWith('order-1');
    expect(orderService.markCanceled).not.toHaveBeenCalled();
    expect(result).toEqual({
      orderId: 'order-1',
      courseId: 'course-1',
      status: 'paid',
    });
  });
});
