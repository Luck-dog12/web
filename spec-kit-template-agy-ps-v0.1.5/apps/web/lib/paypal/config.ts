import { apiGet } from '../api';

type PaymentConfigResponse = {
  paypalClientId: string | null;
};

export function extractPaypalOrderId(redirectUrl: string) {
  try {
    const url = new URL(redirectUrl);
    return url.searchParams.get('token') ?? url.searchParams.get('ba_token') ?? undefined;
  } catch {
    return undefined;
  }
}

export async function getRuntimePaypalClientId() {
  const config = await apiGet<PaymentConfigResponse>('/payment/config');
  return config.paypalClientId;
}
