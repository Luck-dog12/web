'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost, CourseDetail, formatPrice } from '../../../lib/api';

export default function CoursePage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = useMemo(() => params.courseId, [params.courseId]);

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [has, setHas] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'USD' | 'EUR'>('USD');
  const [buying, setBuying] = useState(false);

  async function track(name: string) {
    await apiPost('/metrics/event', { name, courseId }).catch(() => undefined);
  }

  useEffect(() => {
    let canceled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [courseRes, entitlementRes] = await Promise.allSettled([
          apiGet<{ course: CourseDetail }>(`/catalog/courses/${courseId}`),
          apiGet<{ has: boolean }>(`/entitlements/${courseId}`, { credentials: 'include' }),
        ]);

        if (canceled) return;
        if (courseRes.status === 'fulfilled') setCourse(courseRes.value.course);
        if (entitlementRes.status === 'fulfilled') setHas(entitlementRes.value.has);
        if (entitlementRes.status === 'rejected') setHas(null);
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
  }, [courseId]);

  async function buy() {
    if (buying) return;
    setError(null);
    setBuying(true);
    try {
      await track(has ? 'repurchase' : 'purchase');
      const res = await apiPost<{ redirectUrl: string }>(
        `/payment/checkout/${courseId}`,
        { provider: 'paypal', currency },
        { credentials: 'include' },
      );
      if (/^https?:\/\//i.test(res.redirectUrl)) {
        window.location.assign(res.redirectUrl);
      } else {
        router.push(res.redirectUrl);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('Unauthorized')) {
        router.push(`/login?next=${encodeURIComponent(`/courses/${courseId}`)}`);
        return;
      }
      setError(e instanceof Error ? e.message : '购买失败');
    } finally {
      setBuying(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
          <Link className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]" href="/">
            返回
          </Link>
          <Link className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]" href="/login">
            登录
          </Link>
        </div>

        <div className="glass-shell mt-6 p-6">
          {loading ? <div className="text-sm text-[var(--text-secondary)]">加载中…</div> : null}
          {error ? <div className="text-sm text-[var(--danger)]">{error}</div> : null}

          {course ? (
            <>
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h1 className="text-2xl font-semibold">{course.title}</h1>
                  <div className="mt-2 text-sm text-[var(--text-secondary)]">{course.description}</div>
                  <div className="mt-3 flex gap-2 text-xs text-[var(--text-secondary)]">
                    {course.cuisine ? (
                      <span className="status-pill">{course.cuisine}</span>
                    ) : null}
                    {course.difficulty ? (
                      <span className="status-pill">
                        {course.difficulty}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="brand-title text-3xl font-semibold text-[var(--accent-amber)]">
                    {formatPrice(
                      currency === 'USD'
                        ? (course.priceCentsUsd ?? course.priceCents)
                        : (course.priceCentsEur ?? course.priceCents),
                      currency,
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2 text-xs">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as 'USD' | 'EUR')}
                      className="field-input rounded-md px-2 py-1"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  {has ? (
                    <Link
                      href={`/watch/${course.id}`}
                      className="action-primary mt-3 inline-flex px-3 py-2 text-sm font-medium"
                    >
                      去观看
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={buy}
                      disabled={buying}
                      className="action-primary mt-3 inline-flex px-3 py-2 text-sm font-medium"
                    >
                      {buying ? '跳转支付中…' : '购买并观看'}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <div className="subtle-label">课程内容</div>
                <div className="mt-2 space-y-2">
                  {course.videos.map((v) => (
                    <div
                      key={v.id}
                      className="section-shell flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <div className="font-medium">{v.title}</div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {v.durationSeconds ? `${Math.round(v.durationSeconds / 60)} 分钟` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

