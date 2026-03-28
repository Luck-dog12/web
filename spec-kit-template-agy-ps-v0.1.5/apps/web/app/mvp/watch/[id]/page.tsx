'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getPlayback } from '../../../../lib/mvp/functions';
import { getSupabaseBrowserClient } from '../../../../lib/mvp/supabase-client';

type PlaybackPayload = {
  hls_url: string;
  dash_url: string;
  iframe_url: string;
};

export default function MvpWatchPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const videoId = useMemo(() => params.id, [params.id]);
  const [playback, setPlayback] = useState<PlaybackPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabaseBrowserClient();
        const sessionRes = await supabase.auth.getSession();
        if (!sessionRes.data.session) {
          router.replace(`/mvp/login?next=${encodeURIComponent(`/mvp/watch/${videoId}`)}`);
          return;
        }
        const res = await getPlayback(videoId);
        if (!canceled) setPlayback(res);
      } catch (e) {
        if (!canceled) setError(e instanceof Error ? e.message : '无法获取播放地址');
      } finally {
        if (!canceled) setLoading(false);
      }
    }
    void load();
    return () => {
      canceled = true;
    };
  }, [router, videoId]);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/mvp/videos" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            返回视频列表
          </Link>
        </div>
        <div className="glass-shell p-6">
          {loading ? <div className="text-sm text-[var(--text-secondary)]">加载播放地址中…</div> : null}
          {error ? <div className="text-sm text-[var(--danger)]">{error}</div> : null}
          {playback ? (
            <video
              controls
              playsInline
              className="w-full rounded-md border border-[var(--border-soft)] bg-black"
              src={playback.hls_url || playback.dash_url}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
