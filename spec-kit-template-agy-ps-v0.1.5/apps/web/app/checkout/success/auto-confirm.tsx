'use client';

import { useEffect, useRef, useState } from 'react';
import { apiPost } from '../../../lib/api';

type CaptureResponse = {
  status: 'paid';
};

export function CheckoutSuccessAutoConfirm({
  courseId,
  orderId,
  providerOrderId,
  enabled,
}: {
  courseId?: string;
  orderId?: string;
  providerOrderId?: string;
  enabled: boolean;
}) {
  const attemptedRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !courseId || !orderId || !providerOrderId || attemptedRef.current) return;

    attemptedRef.current = true;
    let cancelled = false;

    void (async () => {
      try {
        setMessage('Reconfirming your PayPal payment...');
        const result = await apiPost<CaptureResponse>(
          '/payment/capture',
          { orderId, providerOrderId },
          { credentials: 'include' },
        );
        if (cancelled || result.status !== 'paid') return;

        window.location.assign(`/watch/${courseId}`);
      } catch (error) {
        if (cancelled) return;
        setMessage(
          error instanceof Error
            ? error.message
            : 'Failed to confirm your payment automatically.',
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, enabled, orderId, providerOrderId]);

  if (!enabled || !message) return null;

  return (
    <div className="mt-3 text-xs text-[var(--text-secondary)]">
      {message}
    </div>
  );
}
