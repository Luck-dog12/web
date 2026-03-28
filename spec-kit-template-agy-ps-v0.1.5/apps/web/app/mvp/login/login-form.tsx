'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { getSupabaseBrowserClient } from '../../../lib/mvp/supabase-client';

export function MvpLoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === 'register') {
        const signUpRes = await supabase.auth.signUp({ email, password });
        if (signUpRes.error) throw signUpRes.error;
        setMessage('注册成功，请登录后继续');
        setMode('login');
      } else {
        const signInRes = await supabase.auth.signInWithPassword({ email, password });
        if (signInRes.error) throw signInRes.error;
        router.replace(nextPath);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-md glass-shell p-6">
        <h1 className="text-2xl font-semibold">{mode === 'login' ? '登录' : '注册'}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">MVP 支付链路使用 Supabase Auth。</p>
        <form className="mt-6 space-y-3" onSubmit={submit}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input w-full rounded-md px-3 py-2"
            placeholder="邮箱"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input w-full rounded-md px-3 py-2"
            placeholder="密码（至少 8 位）"
          />
          {error ? <div className="text-sm text-[var(--danger)]">{error}</div> : null}
          {message ? <div className="text-sm text-[var(--ok)]">{message}</div> : null}
          <button
            type="submit"
            disabled={loading}
            className="action-primary w-full rounded-md px-3 py-2 text-sm font-medium"
          >
            {loading ? '提交中…' : mode === 'login' ? '登录并继续' : '注册账号'}
          </button>
        </form>
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            onClick={() => setMode((v) => (v === 'login' ? 'register' : 'login'))}
          >
            {mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
          </button>
          <Link href="/mvp/videos" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            返回列表
          </Link>
        </div>
      </div>
    </div>
  );
}
