'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiPost } from '../../lib/api';

type Mode = 'login' | 'register';

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await apiPost('/auth/login', { email, password }, { credentials: 'include' });
      } else {
        await apiPost('/auth/register', { email, password }, { credentials: 'include' });
      }
      router.replace(nextPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--text-primary)]">
      <div className="glass-shell mx-auto max-w-md p-6">
        <div className="flex items-center justify-between">
          <h1 className="brand-title text-3xl font-semibold">{mode === 'login' ? '登录' : '注册'}</h1>
          <Link className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]" href="/">
            返回首页
          </Link>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              mode === 'login'
                ? 'border-[var(--accent-amber)] bg-[var(--accent-amber-glow)] text-[var(--text-primary)]'
                : 'border-[var(--border-soft)] text-[var(--text-secondary)]'
            }`}
            onClick={() => setMode('login')}
          >
            登录
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              mode === 'register'
                ? 'border-[var(--accent-amber)] bg-[var(--accent-amber-glow)] text-[var(--text-primary)]'
                : 'border-[var(--border-soft)] text-[var(--text-secondary)]'
            }`}
            onClick={() => setMode('register')}
          >
            注册
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <div className="subtle-label">邮箱</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input mt-1 w-full px-3 py-2 text-sm"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <div className="subtle-label">密码</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="field-input mt-1 w-full px-3 py-2 text-sm"
              placeholder="至少 8 位"
            />
          </label>
          {error ? <div className="text-sm text-[var(--danger)]">{error}</div> : null}
          <button
            type="button"
            className="action-primary mt-2 w-full px-3 py-2 text-sm font-medium disabled:opacity-60"
            disabled={loading}
            onClick={submit}
          >
            {loading ? '处理中…' : mode === 'login' ? '登录' : '注册'}
          </button>
        </div>
      </div>
    </div>
  );
}

