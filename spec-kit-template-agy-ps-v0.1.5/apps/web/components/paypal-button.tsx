'use client';

import { useEffect, useEffectEvent, useId, useState } from 'react';
import { loadPaypalScript } from '../lib/paypal/sdk';

type PaypalButtonProps = {
  clientId: string;
  currency: 'USD' | 'EUR';
  createOrder: () => Promise<string>;
  onApprove: (data: PaypalButtonsOnApproveData) => Promise<void>;
  onCancel?: (data: PaypalButtonsOnCancelData) => Promise<void> | void;
  onError?: (error: unknown) => void;
  disabled?: boolean;
  loadingText?: string;
  creatingText?: string;
  capturingText?: string;
  cancelledText?: string;
  defaultErrorText?: string;
};

type ButtonPhase = 'loading' | 'ready' | 'creating' | 'capturing' | 'cancelled';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function PaypalButton({
  clientId,
  currency,
  createOrder,
  onApprove,
  onCancel,
  onError,
  disabled = false,
  loadingText = '\u6b63\u5728\u52a0\u8f7d PayPal \u652f\u4ed8\u6309\u94ae\u2026',
  creatingText = '\u6b63\u5728\u521b\u5efa PayPal \u8ba2\u5355\u2026',
  capturingText = '\u6b63\u5728\u786e\u8ba4\u652f\u4ed8\u7ed3\u679c\u2026',
  cancelledText = '\u4f60\u5df2\u53d6\u6d88 PayPal \u652f\u4ed8\uff0c\u53ef\u4ee5\u7a0d\u540e\u91cd\u8bd5\u3002',
  defaultErrorText = 'PayPal \u652f\u4ed8\u5931\u8d25',
}: PaypalButtonProps) {
  const buttonId = useId().replace(/:/g, '');
  const [phase, setPhase] = useState<ButtonPhase>('loading');
  const [error, setError] = useState<string | null>(null);

  const reportError = useEffectEvent((nextError: unknown) => {
    onError?.(nextError);
  });

  const handleCreateOrder = useEffectEvent(async () => {
    if (disabled) throw new Error('\u652f\u4ed8\u6309\u94ae\u6682\u4e0d\u53ef\u7528');

    setError(null);
    setPhase('creating');
    try {
      const orderId = await createOrder();
      setPhase('ready');
      return orderId;
    } catch (nextError) {
      setPhase('ready');
      setError(getErrorMessage(nextError, defaultErrorText));
      reportError(nextError);
      throw nextError;
    }
  });

  const handleApprove = useEffectEvent(async (data: PaypalButtonsOnApproveData) => {
    setError(null);
    setPhase('capturing');
    try {
      await onApprove(data);
      setPhase('ready');
    } catch (nextError) {
      setPhase('ready');
      setError(getErrorMessage(nextError, defaultErrorText));
      reportError(nextError);
      throw nextError;
    }
  });

  const handleCancel = useEffectEvent(async (data: PaypalButtonsOnCancelData) => {
    setError(null);
    setPhase('cancelled');
    try {
      await onCancel?.(data);
    } catch (nextError) {
      setPhase('ready');
      setError(getErrorMessage(nextError, defaultErrorText));
      reportError(nextError);
      throw nextError;
    }
  });

  const handleSdkError = useEffectEvent((nextError: unknown) => {
    setPhase('ready');
    setError(getErrorMessage(nextError, defaultErrorText));
    reportError(nextError);
  });

  useEffect(() => {
    let cancelled = false;
    const selector = `#paypal-button-${buttonId}`;

    async function mountButton() {
      setError(null);
      setPhase('loading');
      await loadPaypalScript({ clientId, currency, intent: 'capture' });
      if (!window.paypal) throw new Error('PayPal SDK \u521d\u59cb\u5316\u5931\u8d25');

      const container = document.querySelector<HTMLElement>(selector);
      if (!container) return;
      container.innerHTML = '';

      await window.paypal
        .Buttons({
          style: {
            layout: 'vertical',
            shape: 'rect',
            label: 'paypal',
            tagline: false,
          },
          onInit: (_, actions) => {
            if (disabled) actions.disable();
            else actions.enable();
            if (!cancelled) setPhase('ready');
          },
          createOrder: () => handleCreateOrder(),
          onApprove: (data) => handleApprove(data),
          onCancel: (data) => handleCancel(data),
          onError: (nextError) => handleSdkError(nextError),
        })
        .render(selector);
    }

    void mountButton().catch((nextError) => {
      if (cancelled) return;
      handleSdkError(nextError);
    });

    return () => {
      cancelled = true;
      const container = document.querySelector<HTMLElement>(selector);
      if (container) container.innerHTML = '';
    };
  }, [
    buttonId,
    clientId,
    currency,
    disabled,
    handleApprove,
    handleCancel,
    handleCreateOrder,
    handleSdkError,
  ]);

  const statusText =
    phase === 'loading'
      ? loadingText
      : phase === 'creating'
        ? creatingText
        : phase === 'capturing'
          ? capturingText
          : phase === 'cancelled'
            ? cancelledText
            : null;

  return (
    <div className="space-y-2">
      <div
        id={`paypal-button-${buttonId}`}
        className={
          phase === 'capturing' || phase === 'creating' || disabled
            ? 'pointer-events-none opacity-60'
            : undefined
        }
      />
      {statusText ? <div className="text-xs text-[var(--text-secondary)]">{statusText}</div> : null}
      {error ? <div className="text-sm text-[var(--danger)]">{error}</div> : null}
    </div>
  );
}
