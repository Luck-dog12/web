'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PaypalButton } from '../../../../components/paypal-button';
import { capturePaypalOrder, createPaypalOrder } from '../../../../lib/mvp/functions';
import { getRuntimePaypalClientId } from '../../../../lib/paypal/config';
import { getSupabaseBrowserClient } from '../../../../lib/mvp/supabase-client';

type VideoDetail = {
  id: string;
  title: string;
  price_usd: number;
  status: string;
};

export default function MvpVideoDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const videoId = useMemo(() => params.id, [params.id]);

  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState<string | null>(
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? null,
  );

  useEffect(() => {
    let canceled = false;

    void getRuntimePaypalClientId()
      .then((clientId) => {
        if (!canceled) {
          setPaypalClientId(clientId ?? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? null);
        }
      })
      .catch(() => undefined);

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabaseBrowserClient();
        const sessionRes = await supabase.auth.getSession();
        if (!sessionRes.data.session) {
          router.replace(`/mvp/login?next=${encodeURIComponent(`/mvp/videos/${videoId}`)}`);
          return;
        }

        setAuthed(true);

        const [videoRes, entitlementRes] = await Promise.all([
          supabase
            .from('videos')
            .select('id,title,price_usd,status')
            .eq('id', videoId)
            .eq('status', 'published')
            .single(),
          supabase
            .from('entitlements')
            .select('id')
            .eq('video_id', videoId)
            .eq('status', 'active')
            .maybeSingle(),
        ]);

        if (videoRes.error || !videoRes.data) {
          throw new Error('\u89c6\u9891\u4e0d\u5b58\u5728');
        }
        if (entitlementRes.error) {
          throw new Error(entitlementRes.error.message);
        }

        if (!canceled) {
          setVideo(videoRes.data as VideoDetail);
          setHasAccess(Boolean(entitlementRes.data));
        }
      } catch (nextError) {
        if (!canceled) {
          setError(
            nextError instanceof Error ? nextError.message : '\u521d\u59cb\u5316\u5931\u8d25',
          );
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    void init();
    return () => {
      canceled = true;
    };
  }, [router, videoId]);

  async function handleCreateOrder() {
    const created = await createPaypalOrder(videoId);
    return created.paypal_order_id;
  }

  async function handleApprove(data: PaypalButtonsOnApproveData) {
    const orderId = data.orderID;
    if (!orderId) throw new Error('Missing PayPal order id');
    await capturePaypalOrder(orderId);
    setHasAccess(true);
    router.push(`/mvp/watch/${videoId}`);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/mvp/videos"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          {'\u8fd4\u56de\u89c6\u9891\u5217\u8868'}
        </Link>

        <div className="glass-shell mt-4 p-6">
          <h1 className="text-2xl font-semibold">{video?.title ?? '\u52a0\u8f7d\u4e2d\u2026'}</h1>
          <div className="mt-2 text-sm text-[var(--text-secondary)]">
            {video ? `$${Number(video.price_usd).toFixed(2)} USD` : ''}
          </div>

          {loading ? (
            <div className="mt-6 text-sm text-[var(--text-secondary)]">
              {'\u6b63\u5728\u51c6\u5907\u652f\u4ed8\u4fe1\u606f\u2026'}
            </div>
          ) : null}

          {!loading && authed && hasAccess && video ? (
            <div className="mt-6 space-y-3">
              <div className="text-sm text-[var(--text-secondary)]">
                {
                  '\u8fd9\u4e2a\u89c6\u9891\u5df2\u7ecf\u8d2d\u4e70\uff0c\u53ef\u4ee5\u76f4\u63a5\u5f00\u59cb\u89c2\u770b\u3002'
                }
              </div>
              <Link
                href={`/mvp/watch/${videoId}`}
                className="action-primary inline-flex px-3 py-2 text-sm font-medium"
              >
                {'\u53bb\u89c2\u770b'}
              </Link>
            </div>
          ) : null}

          {!loading && authed && !hasAccess && video ? (
            <div className="mt-6 max-w-[280px]">
              {paypalClientId ? (
                <PaypalButton
                  clientId={paypalClientId}
                  currency="USD"
                  createOrder={handleCreateOrder}
                  onApprove={handleApprove}
                  defaultErrorText={'PayPal \u652f\u4ed8\u5931\u8d25'}
                  loadingText={'\u6b63\u5728\u52a0\u8f7d PayPal \u652f\u4ed8\u6309\u94ae\u2026'}
                  creatingText={'\u6b63\u5728\u521b\u5efa PayPal \u8ba2\u5355\u2026'}
                  capturingText={
                    '\u6b63\u5728\u786e\u8ba4 PayPal \u652f\u4ed8\u6210\u529f\u72b6\u6001\u2026'
                  }
                  cancelledText={
                    '\u4f60\u5df2\u53d6\u6d88 PayPal \u652f\u4ed8\uff0c\u53ef\u4ee5\u7a0d\u540e\u91cd\u8bd5\u3002'
                  }
                />
              ) : (
                <div className="text-sm text-[var(--danger)]">
                  {'NEXT_PUBLIC_PAYPAL_CLIENT_ID is required'}
                </div>
              )}
            </div>
          ) : null}

          {error ? <div className="mt-3 text-sm text-[var(--danger)]">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}
