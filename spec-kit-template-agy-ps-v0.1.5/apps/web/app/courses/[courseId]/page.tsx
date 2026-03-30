'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PaypalButton } from '../../../components/paypal-button';
import { apiGet, apiPost, CourseDetail, formatPrice } from '../../../lib/api';
import { extractPaypalOrderId, getRuntimePaypalClientId } from '../../../lib/paypal/config';

type CheckoutResponse = {
  orderId: string;
  providerOrderId?: string;
  redirectUrl: string;
};

type CaptureResponse = {
  status: 'paid';
};

export default function CoursePage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = useMemo(() => params.courseId, [params.courseId]);

  const pendingOrderIdRef = useRef<string | null>(null);

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
    pendingOrderIdRef.current = null;
  }, [currency, courseId]);

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
      pendingOrderIdRef.current = res.orderId;
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

  async function createPaypalOrder() {
    try {
      await track(has ? 'repurchase' : 'purchase');
      const res = await apiPost<CheckoutResponse>(
        `/payment/checkout/${courseId}`,
        { provider: 'paypal', currency },
        { credentials: 'include' },
      );
      pendingOrderIdRef.current = res.orderId;
      const providerOrderId = res.providerOrderId ?? extractPaypalOrderId(res.redirectUrl);
      if (!providerOrderId) throw new Error('PayPal order id is missing');
      return providerOrderId;
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message.includes('Unauthorized')) {
        router.push(`/login?next=${encodeURIComponent(`/courses/${courseId}`)}`);
      }
      throw nextError;
    }
  }

  async function capturePaypalOrder(data: PaypalButtonsOnApproveData) {
    const orderId = pendingOrderIdRef.current;
    if (!orderId) throw new Error('Missing checkout order id');
    if (!data.orderID) throw new Error('Missing PayPal order id');

    try {
      const result = await apiPost<CaptureResponse>(
        '/payment/capture',
        { orderId, providerOrderId: data.orderID },
        { credentials: 'include' },
      );
      if (result.status !== 'paid') {
        throw new Error('PayPal payment is still pending confirmation');
      }

      setHas(true);
      router.push(`/watch/${courseId}`);
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message.includes('Unauthorized')) {
        router.push(`/login?next=${encodeURIComponent(`/courses/${courseId}`)}`);
      }
      throw nextError;
    }
  }

  async function cancelPaypalOrder() {
    const orderId = pendingOrderIdRef.current;
    const query = new URLSearchParams({ courseId, reason: 'buyer_cancelled' });
    if (orderId) {
      query.set('orderId', orderId);
    }
    router.push(`/checkout/cancel?${query.toString()}`);
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
                    <div className="mt-3 w-[280px] max-w-full">
                      <PaypalButton
                        clientId={paypalClientId}
                        currency={currency}
                        createOrder={createPaypalOrder}
                        onApprove={capturePaypalOrder}
                        onCancel={cancelPaypalOrder}
                        defaultErrorText={'PayPal \u8d2d\u4e70\u5931\u8d25'}
                        loadingText={'\u6b63\u5728\u52a0\u8f7d PayPal \u6309\u94ae\u2026'}
                        creatingText={'\u6b63\u5728\u521b\u5efa PayPal \u8ba2\u5355\u2026'}
                        capturingText={
                          '\u6b63\u5728\u786e\u8ba4\u652f\u4ed8\u6210\u529f\u72b6\u6001\u2026'
                        }
                        cancelledText={
                          '\u4f60\u5df2\u53d6\u6d88 PayPal \u652f\u4ed8\uff0c\u53ef\u4ee5\u7a0d\u540e\u91cd\u8bd5\u3002'
                        }
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startRedirectCheckout}
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
