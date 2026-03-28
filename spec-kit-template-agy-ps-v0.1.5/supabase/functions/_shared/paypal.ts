import { createServiceClient } from './supabase.ts';

type PaypalRequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

async function requireSecret(name: string) {
  const value = Deno.env.get(name);
  if (value) return value;
  const supabase = createServiceClient();
  const secretRes = await supabase
    .from('runtime_secrets')
    .select('secret_value')
    .eq('secret_key', name)
    .maybeSingle();
  const secretValue = secretRes.data?.secret_value;
  if (secretValue) return String(secretValue);
  throw new Error(`${name} is required`);
}

async function getAccessToken(baseUrl: string) {
  const clientId = await requireSecret('PAYPAL_CLIENT_ID');
  const clientSecret = await requireSecret('PAYPAL_CLIENT_SECRET');
  const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error('Failed to get PayPal access token');
  }
  return tokenData.access_token as string;
}

export async function paypalRequest(path: string, options: PaypalRequestOptions = {}) {
  const baseUrl = Deno.env.get('PAYPAL_BASE_URL') ?? 'https://api-m.sandbox.paypal.com';
  const accessToken = await getAccessToken(baseUrl);
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`PayPal request failed: ${JSON.stringify(data)}`);
  }
  return data as Record<string, unknown>;
}
