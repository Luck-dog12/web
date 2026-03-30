import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';

type VerifyWebhookResponse = {
  verification_status?: string;
};

type AccessTokenResponse = {
  access_token?: string;
};

type PaypalOrderDetailsResponse = {
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

@Injectable()
export class PaypalService {
  private get clientId() {
    return process.env.PAYPAL_CLIENT_ID?.trim();
  }

  private get secret() {
    return process.env.PAYPAL_CLIENT_SECRET?.trim();
  }

  private get webhookId() {
    return process.env.PAYPAL_WEBHOOK_ID?.trim();
  }

  getBaseUrl() {
    return process.env.PAYPAL_BASE_URL ?? 'https://api-m.sandbox.paypal.com';
  }

  getClientId() {
    return this.clientId ?? null;
  }

  assertCheckoutConfigured() {
    if (this.clientId && this.secret) return;
    throw new ServiceUnavailableException('PayPal checkout is not configured');
  }

  private assertWebhookConfigured() {
    if (this.clientId && this.secret && this.webhookId) return;
    throw new ServiceUnavailableException(
      'PayPal webhook verification is not configured',
    );
  }

  private getHeader(headers: IncomingHttpHeaders, name: string) {
    const value = headers[name];
    if (Array.isArray(value)) return value[0];
    return value;
  }

  async createAccessToken() {
    this.assertCheckoutConfigured();

    const tokenRes = await fetch(`${this.getBaseUrl()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = (await tokenRes
      .json()
      .catch(() => ({}))) as AccessTokenResponse;
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new ServiceUnavailableException(
        'Failed to authenticate with PayPal',
      );
    }
    return tokenData.access_token;
  }

  async getOrderDetails(orderId: string) {
    const accessToken = await this.createAccessToken();
    const orderRes = await fetch(
      `${this.getBaseUrl()}/v2/checkout/orders/${orderId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const orderData = (await orderRes
      .json()
      .catch(() => ({}))) as PaypalOrderDetailsResponse;
    if (!orderRes.ok) {
      throw new ServiceUnavailableException(
        orderData.message ?? 'Failed to fetch PayPal order details',
      );
    }
    return orderData;
  }

  async verifyWebhookSignature(headers: IncomingHttpHeaders, event: unknown) {
    this.assertWebhookConfigured();

    const transmissionId = this.getHeader(headers, 'paypal-transmission-id');
    const transmissionTime = this.getHeader(
      headers,
      'paypal-transmission-time',
    );
    const transmissionSig = this.getHeader(headers, 'paypal-transmission-sig');
    const certUrl = this.getHeader(headers, 'paypal-cert-url');
    const authAlgo = this.getHeader(headers, 'paypal-auth-algo');

    if (
      !transmissionId ||
      !transmissionTime ||
      !transmissionSig ||
      !certUrl ||
      !authAlgo
    ) {
      throw new UnauthorizedException(
        'Missing PayPal webhook signature headers',
      );
    }

    const accessToken = await this.createAccessToken();
    const verifyRes = await fetch(
      `${this.getBaseUrl()}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: this.webhookId,
          webhook_event: event,
        }),
      },
    );
    const verifyData = (await verifyRes
      .json()
      .catch(() => ({}))) as VerifyWebhookResponse;
    if (!verifyRes.ok || verifyData.verification_status !== 'SUCCESS') {
      throw new UnauthorizedException('Invalid PayPal webhook signature');
    }
  }
}
