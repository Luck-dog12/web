'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, CourseDetail, formatPrice } from '../../../lib/api';
import { getRuntimePaypalClientId } from '../../../lib/paypal/config';

type CheckoutResponse = {
  orderId: string;
  providerOrderId?: string;
  redirectUrl: string;
};

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
  const [paypalClientId, setPaypalClientId] = useState<string | null>(
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? null,
  );

  async function track(name: string) {
    await apiPost('/metrics/event', { name, courseId }).catch(() => undefined);
  }

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

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [courseRes, entitlementRes] = await Promise.allSettled([
          apiGet<{ course: CourseDetail }>(`/catalog/courses/${courseId}`),
          apiGet<{ has: boolean }>(`/entitlements/${courseId}`, { credentials: 'include' }),
        ]);

        if (canceled) return;

        if (courseRes.status === 'fulfilled') {
          setCourse(courseRes.value.course);
        } else {
          setCourse(null);
          setError(
            courseRes.reason instanceof Error ? courseRes.reason.message : 'Failed to load course',
          );
        }

        if (entitlementRes.status === 'fulfilled') setHas(entitlementRes.value.has);
        else setHas(null);
      } catch (nextError) {
        if (!canceled) {
          setError(nextError instanceof Error ? nextError.message : 'Failed to load course');
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    void load();
    return () => {
      canceled = true;
    };
  }, [courseId]);

  async function startRedirectCheckout() {
    if (buying) return;

    setError(null);
    setBuying(true);
    try {
      await track(has ? 'repurchase' : 'purchase');
      const res = await apiPost<CheckoutResponse>(
        `/payment/checkout/${courseId}`,
        { provider: 'paypal', currency },
        { credentials: 'include' },
      );
      if (/^https?:\/\//i.test(res.redirectUrl)) {
        window.location.assign(res.redirectUrl);
      } else {
        router.push(res.redirectUrl);
      }
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message.includes('Unauthorized')) {
        router.push(`/login?next=${encodeURIComponent(`/courses/${courseId}`)}`);
        return;
      }
      setError(nextError instanceof Error ? nextError.message : 'Failed to start checkout');
    } finally {
      setBuying(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
          <Link
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            href="/"
          >
            {'\u8fd4\u56de'}
          </Link>
          <Link
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            href="/login"
          >
            {'\u767b\u5f55'}
          </Link>
        </div>

        <div className="glass-shell mt-6 p-6">
          {loading ? (
            <div className="text-sm text-[var(--text-secondary)]">{'\u52a0\u8f7d\u4e2d\u2026'}</div>
          ) : null}
          {error ? <div className="text-sm text-[var(--danger)]">{error}</div> : null}

          {course ? (
            <>
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h1 className="text-2xl font-semibold">{course.title}</h1>
                  <div className="mt-2 text-sm text-[var(--text-secondary)]">
                    {course.description}
                  </div>
                  <div className="mt-3 flex gap-2 text-xs text-[var(--text-secondary)]">
                    {course.cuisine ? <span className="status-pill">{course.cuisine}</span> : null}
                    {course.difficulty ? (
                      <span className="status-pill">{course.difficulty}</span>
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
                      onChange={(event) => setCurrency(event.target.value as 'USD' | 'EUR')}
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
                      {'\u53bb\u89c2\u770b'}
                    </Link>
                  ) : paypalClientId ? (
                    <div className="mt-3 w-[280px] max-w-full space-y-2">
                      <button
                        type="button"
                        onClick={() => void startRedirectCheckout()}
                        disabled={buying}
                        className="inline-flex w-full items-center justify-center rounded-xl border border-[#003087]/15 bg-[#FFC439] px-4 py-3 text-base font-semibold text-[#003087] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {buying ? 'Opening PayPal...' : 'PayPal'}
                      </button>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {'\u70b9\u51fb\u540e\u5c06\u8df3\u8f6c\u5230 PayPal \u4e2a\u4eba\u652f\u4ed8\u754c\u9762'}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startRedirectCheckout()}
                      disabled={buying}
                      className="action-primary mt-3 inline-flex px-3 py-2 text-sm font-medium"
                    >
                      {buying
                        ? '\u8df3\u8f6c\u652f\u4ed8\u4e2d\u2026'
                        : '\u8d2d\u4e70\u5e76\u89c2\u770b'}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <div className="subtle-label">{'\u8bfe\u7a0b\u5185\u5bb9'}</div>
                <div className="mt-2 space-y-2">
                  {course.videos.map((video) => (
                    <div
                      key={video.id}
                      className="section-shell flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <div className="font-medium">{video.title}</div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {video.durationSeconds
                          ? `${Math.round(video.durationSeconds / 60)} \u5206\u949f`
                          : ''}
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
