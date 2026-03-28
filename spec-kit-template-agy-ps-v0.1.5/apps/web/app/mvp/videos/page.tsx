'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '../../../lib/mvp/supabase-client';

type VideoItem = {
  id: string;
  title: string;
  price_usd: number;
  status: string;
};

export default function MvpVideosPage() {
  const [items, setItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let canceled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabaseBrowserClient();
        const [sessionRes, videosRes] = await Promise.all([
          supabase.auth.getSession(),
          supabase
            .from('videos')
            .select('id,title,price_usd,status')
            .eq('status', 'published')
            .order('created_at', { ascending: false }),
        ]);
        if (sessionRes.data.session?.user) setLoggedIn(true);
        if (videosRes.error) throw videosRes.error;
        if (!canceled) setItems((videosRes.data ?? []) as VideoItem[]);
      } catch (e) {
        if (!canceled) setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!canceled) setLoading(false);
      }
    }
    void load();
    return () => {
      canceled = true;
    };
  }, []);

  async function logout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setLoggedIn(false);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">MVP 视频列表</h1>
          <div className="flex items-center gap-3 text-sm">
            {loggedIn ? (
              <button
                type="button"
                onClick={logout}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                退出
              </button>
            ) : (
              <Link href="/mvp/login" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                登录 / 注册
              </Link>
            )}
          </div>
        </div>
        {loading ? <div className="text-sm text-[var(--text-secondary)]">加载中…</div> : null}
        {error ? <div className="text-sm text-[var(--danger)]">{error}</div> : null}
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className="glass-shell p-5">
              <h2 className="text-lg font-medium">{item.title}</h2>
              <div className="mt-2 text-sm text-[var(--text-secondary)]">
                ${Number(item.price_usd).toFixed(2)} USD
              </div>
              <Link href={`/mvp/videos/${item.id}`} className="action-primary mt-4 inline-flex px-3 py-2 text-sm">
                查看详情
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
