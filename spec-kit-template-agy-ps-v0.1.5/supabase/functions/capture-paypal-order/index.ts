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

    const payload = (await req.json().catch(() => ({}))) as { paypal_order_id?: string };
    const paypalOrderId = payload.paypal_order_id;
    if (!paypalOrderId) return json({ message: 'paypal_order_id is required' }, 400);

    const paymentRes = await supabase
      .from('payments')
      .select('id,order_id,paypal_capture_id,orders!inner(id,user_id,video_id,status)')
      .eq('paypal_order_id', paypalOrderId)
      .single();
    if (paymentRes.error || !paymentRes.data) return json({ message: 'Payment not found' }, 404);

    const order = paymentRes.data.orders as { id: string; user_id: string; video_id: string; status: string };
    if (order.user_id !== userId) return json({ message: 'Forbidden' }, 403);

    if (order.status === 'captured') {
      await supabase.from('entitlements').upsert(
        {
          user_id: userId,
          video_id: order.video_id,
          status: 'active',
          granted_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,video_id' },
      );
      return json({
        success: true,
        order_id: order.id,
        paypal_order_id: paypalOrderId,
        paypal_capture_id: paymentRes.data.paypal_capture_id,
      });
    }

    const capture = await paypalRequest(`/v2/checkout/orders/${paypalOrderId}/capture`, { method: 'POST' });
    const purchaseUnits = (capture.purchase_units as Array<Record<string, unknown>> | undefined) ?? [];
    const firstUnit = purchaseUnits[0] ?? {};
    const payments = (firstUnit.payments as Record<string, unknown> | undefined) ?? {};
    const captures = (payments.captures as Array<Record<string, unknown>> | undefined) ?? [];
    const captureId = String(captures[0]?.id ?? '');

    const orderUpdate = await supabase
      .from('orders')
      .update({ status: 'captured' })
      .eq('id', order.id)
      .eq('user_id', userId);
    if (orderUpdate.error) return json({ message: orderUpdate.error.message }, 500);

    const paymentUpdate = await supabase
      .from('payments')
      .update({
        paypal_capture_id: captureId || null,
        raw_json: capture,
      })
      .eq('id', paymentRes.data.id);
    if (paymentUpdate.error) return json({ message: paymentUpdate.error.message }, 500);

    const entitlementUpsert = await supabase.from('entitlements').upsert(
      {
        user_id: userId,
        video_id: order.video_id,
        status: 'active',
        granted_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,video_id' },
    );
    if (entitlementUpsert.error) return json({ message: entitlementUpsert.error.message }, 500);

    return json({
      success: true,
      order_id: order.id,
      paypal_order_id: paypalOrderId,
      paypal_capture_id: captureId || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return json({ message }, 500);
  }
});
