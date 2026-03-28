'use client';

import { getSupabaseBrowserClient } from './supabase-client';

type CreatePaypalOrderResponse = {
  paypal_order_id: string;
  order_id: string;
};

type CapturePaypalOrderResponse = {
  success: boolean;
  order_id: string;
  paypal_order_id: string;
  paypal_capture_id: string | null;
};

type GetPlaybackResponse = {
  video_id: string;
  hls_url: string;
  dash_url: string;
  iframe_url: string;
  expires_in_seconds: number;
};

function getFunctionsBaseUrl() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase) throw new Error('NEXT_PUBLIC_API_BASE_URL is required');
  return apiBase.includes('/functions/v1') ? apiBase : `${apiBase}/functions/v1`;
}

async function callFunction<T>(name: string, body: Record<string, unknown>) {
  const supabase = getSupabaseBrowserClient();
  const sessionRes = await supabase.auth.getSession();
  const token = sessionRes.data.session?.access_token;
  if (!token) throw new Error('请先登录');

  const res = await fetch(`${getFunctionsBaseUrl()}/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? '请求失败');
  return data as T;
}

export function createPaypalOrder(videoId: string) {
  return callFunction<CreatePaypalOrderResponse>('create-paypal-order', { video_id: videoId });
}

export function capturePaypalOrder(paypalOrderId: string) {
  return callFunction<CapturePaypalOrderResponse>('capture-paypal-order', {
    paypal_order_id: paypalOrderId,
  });
}

export function getPlayback(videoId: string) {
  return callFunction<GetPlaybackResponse>('get-playback', { video_id: videoId });
}
