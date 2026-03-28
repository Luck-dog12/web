'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { capturePaypalOrder, createPaypalOrder } from '../../../../lib/mvp/functions';
import { getSupabaseBrowserClient } from '../../../../lib/mvp/supabase-client';

type VideoDetail = {
  id: string;
  title: string;
  price_usd: number;
  status: string;
};

function loadPaypalScript(clientId: string) {
  return new Promise<void>((resolve, reject) => {
    const exists = document.querySelector<HTMLScriptElement>('script[data-paypal-sdk]');
    if (exists) {
      if (window.paypal) resolve();
      else exists.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    script.async = true;
    script.setAttribute('data-paypal-sdk', 'true');
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('PayPal SDK 加载失败'));
    document.body.appendChild(script);
  });
}

export default function MvpVideoDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const videoId = useMemo(() => params.id, [params.id]);

  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let canceled = false;
    async function init() {
      setError(null);
      try {
        const supabase = getSupabaseBrowserClient();
        const sessionRes = await supabase.auth.getSession();
        if (!sessionRes.data.session) {
          router.replace(`/mvp/login?next=${encodeURIComponent(`/mvp/videos/${videoId}`)}`);
          return;
        }
        setAuthed(true);
        const videoRes = await supabase
          .from('videos')
          .select('id,title,price_usd,status')
          .eq('id', videoId)
          .eq('status', 'published')
          .single();
        if (videoRes.error || !videoRes.data) throw new Error('视频不存在');
        if (!canceled) setVideo(videoRes.data as VideoDetail);
        const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
        if (!paypalClientId) throw new Error('NEXT_PUBLIC_PAYPAL_CLIENT_ID is required');
        await loadPaypalScript(paypalClientId);
        if (!window.paypal) throw new Error('PayPal SDK 初始化失败');
        const container = document.getElementById('paypal-button-container');
        if (!container) throw new Error('支付容器不存在');
        container.innerHTML = '';
        await window.paypal
          .Buttons({
            createOrder: async () => {
              const created = await createPaypalOrder(videoId);
              return created.paypal_order_id;
            },
            onApprove: async (data) => {
              const orderId = data.orderID;
              if (!orderId) throw new Error('orderID 缺失');
              await capturePaypalOrder(orderId);
              router.push(`/mvp/watch/${videoId}`);
            },
            onError: (err) => {
              setError(err instanceof Error ? err.message : '支付失败');
            },
          })
          .render('#paypal-button-container');
        if (!canceled) setReady(true);
      } catch (e) {
        if (!canceled) setError(e instanceof Error ? e.message : '初始化失败');
      }
    }
    void init();
    return () => {
      canceled = true;
    };
  }, [router, videoId]);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-3xl">
        <Link href="/mvp/videos" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          返回视频列表
        </Link>
        <div className="glass-shell mt-4 p-6">
          <h1 className="text-2xl font-semibold">{video?.title ?? '加载中…'}</h1>
          <div className="mt-2 text-sm text-[var(--text-secondary)]">
            {video ? `$${Number(video.price_usd).toFixed(2)} USD` : ''}
          </div>
          {authed ? (
            <div className="mt-6">
              <div id="paypal-button-container" />
              {!ready ? <div className="mt-2 text-xs text-[var(--text-secondary)]">正在加载支付按钮…</div> : null}
            </div>
          ) : null}
          {error ? <div className="mt-3 text-sm text-[var(--danger)]">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}
