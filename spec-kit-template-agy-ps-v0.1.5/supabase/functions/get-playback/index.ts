import { corsHeaders, json, readBearerToken } from '../_shared/http.ts';
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

    const entitlementRes = await supabase
      .from('entitlements')
      .select('id,video_id,status,videos!inner(cf_stream_video_id)')
      .eq('user_id', userId)
      .eq('video_id', videoId)
      .eq('status', 'active')
      .single();
    if (entitlementRes.error || !entitlementRes.data) {
      return json({ message: 'No active entitlement' }, 403);
    }

    const video = entitlementRes.data.videos as { cf_stream_video_id: string };
    const streamId = video.cf_stream_video_id;
    const customerCode = Deno.env.get('CF_STREAM_CUSTOMER_CODE')?.trim();
    const hlsUrl = customerCode
      ? `https://${customerCode}.cloudflarestream.com/${streamId}/manifest/video.m3u8`
      : `https://videodelivery.net/${streamId}/manifest/video.m3u8`;
    const dashUrl = customerCode
      ? `https://${customerCode}.cloudflarestream.com/${streamId}/manifest/video.mpd`
      : `https://videodelivery.net/${streamId}/manifest/video.mpd`;
    const iframeUrl = `https://iframe.videodelivery.net/${streamId}`;
    return json({
      video_id: videoId,
      hls_url: hlsUrl,
      dash_url: dashUrl,
      iframe_url: iframeUrl,
      expires_in_seconds: 300,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return json({ message }, 500);
  }
});
