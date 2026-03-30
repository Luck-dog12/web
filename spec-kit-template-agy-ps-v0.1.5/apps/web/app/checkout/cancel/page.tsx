import Link from 'next/link';
import { getSearchParam, requestCheckoutApi } from '../_lib';

type SearchParamsRecord = Record<string, string | string[] | undefined>;

export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsRecord>;
}) {
  const params = (await searchParams) ?? {};
  const courseId = getSearchParam(params, 'courseId');
  const orderId = getSearchParam(params, 'orderId');
  const reason = getSearchParam(params, 'reason');
  const retryHref = courseId ? `/courses/${courseId}` : '/';
  let cancelSyncError: string | null = null;

  if (orderId && reason === 'buyer_cancelled') {
    try {
      await requestCheckoutApi('/payment/cancel', {
        method: 'POST',
        body: JSON.stringify({ orderId }),
      });
    } catch (error) {
      cancelSyncError =
        error instanceof Error ? error.message : 'Failed to sync cancel status';
    }
  }

  const title =
    cancelSyncError
      ? '\u53d6\u6d88\u72b6\u6001\u5f85\u786e\u8ba4'
      : reason === 'system_error'
        ? '\u652f\u4ed8\u672a\u5b8c\u6210'
        : '\u5df2\u53d6\u6d88\u652f\u4ed8';
  const description =
    cancelSyncError
      ? '\u4f60\u5df2\u5728 PayPal \u7a97\u53e3\u91cc\u53d6\u6d88\u652f\u4ed8\uff0c\u4f46\u6211\u4eec\u6682\u65f6\u6ca1\u80fd\u540c\u6b65\u8ba2\u5355\u72b6\u6001\u3002\u8bf7\u8fd4\u56de\u8bfe\u7a0b\u9875\u540e\u91cd\u8bd5\u6216\u7a0d\u540e\u518d\u67e5\u770b\u3002'
      : reason === 'system_error'
      ? '\u8fd9\u6b21 PayPal \u4e0b\u5355\u6ca1\u6709\u6210\u529f\u5b8c\u6210\uff0c\u53ef\u4ee5\u8fd4\u56de\u8bfe\u7a0b\u9875\u91cd\u8bd5\u3002'
      : '\u8fd9\u7b14\u8ba2\u5355\u4e0d\u4f1a\u6263\u6b3e\uff0c\u4f60\u53ef\u4ee5\u7a0d\u540e\u56de\u6765\u7ee7\u7eed\u8d2d\u4e70\u3002';

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--text-primary)]">
      <div className="glass-shell mx-auto max-w-md p-6">
        <div className="brand-title text-4xl font-semibold">{title}</div>
        <div className="mt-2 text-sm text-[var(--text-secondary)]">{description}</div>
        {cancelSyncError ? (
          <div className="mt-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {cancelSyncError}
          </div>
        ) : null}
        <div className="mt-6 flex gap-3">
          <Link className="action-ghost px-3 py-2 text-sm font-medium" href="/">
            {'\u8fd4\u56de\u9996\u9875'}
          </Link>
          <Link className="action-primary px-3 py-2 text-sm font-medium" href={retryHref}>
            {'\u91cd\u65b0\u8d2d\u4e70'}
          </Link>
        </div>
      </div>
    </div>
  );
}
