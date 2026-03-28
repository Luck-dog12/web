import { corsHeaders, json, readBearerToken } from '../_shared/http.ts';
import { paypalRequest } from '../_shared/paypal.ts';
import { createServiceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  try {
    const token = readBearerToken(req);
    if (!token) return json({ message: 'Unauthorized' }, 401);
    const supabase = createServiceClient();
    const authRes = await supabase.auth.getUser(token);
    const userId = authRes.data.user?.id;
    if (!userId) return json({ message: 'Unauthorized' }, 401);

    const payload = (await req.json().catch(() => ({}))) as { video_id?: string };
    const videoId = payload.video_id;
    if (!videoId) return json({ message: 'video_id is required' }, 400);

    const videoRes = await supabase
      .from('videos')
      .select('id,title,price_usd,status')
      .eq('id', videoId)
      .single();
    if (videoRes.error || !videoRes.data) return json({ message: 'Video not found' }, 404);
    if (videoRes.data.status !== 'published') return json({ message: 'Video not available' }, 400);

    const paypalOrder = await paypalRequest('/v2/checkout/orders', {
      method: 'POST',
      body: {
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: videoRes.data.id,
            amount: {
              currency_code: 'USD',
              value: Number(videoRes.data.price_usd).toFixed(2),
            },
            description: String(videoRes.data.title),
          },
        ],
      },
    });

    const paypalOrderId = String(paypalOrder.id ?? '');
    if (!paypalOrderId) return json({ message: 'Failed to create paypal order' }, 502);

    const orderInsert = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        video_id: videoRes.data.id,
        amount_usd: videoRes.data.price_usd,
        currency: 'USD',
        status: 'pending',
      })
      .select('id')
      .single();
    if (orderInsert.error || !orderInsert.data) {
      return json({ message: orderInsert.error?.message ?? 'Failed to create order' }, 500);
    }

    const paymentInsert = await supabase
      .from('payments')
      .insert({
        order_id: orderInsert.data.id,
        paypal_order_id: paypalOrderId,
        raw_json: paypalOrder,
      })
      .select('id')
      .single();
    if (paymentInsert.error) {
      return json({ message: paymentInsert.error.message }, 500);
    }

    return json({
      paypal_order_id: paypalOrderId,
      order_id: orderInsert.data.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return json({ message }, 500);
  }
});
