import Link from 'next/link';
import { buildCheckoutPageHref, getSearchParam, requestCheckoutApi } from '../_lib';

type SearchParamsRecord = Record<string, string | string[] | undefined>;

type EntitlementResponse = {
  has: boolean;
};

type CaptureResponse = {
  status: 'paid';
};

type OrdersResponse = {
  orders: Array<{ id: string; status: 'pending' | 'paid' | 'failed' | 'canceled' }>;
};

type PageState = {
  title: string;
  body: string;
  kind: 'granted' | 'pending' | 'failed' | 'canceled';
};

async function resolvePageState(
  courseId: string | undefined,
  orderId: string | undefined,
  providerOrderId: string | undefined,
) {
  if (orderId && providerOrderId) {
    try {
      const capture = await requestCheckoutApi<CaptureResponse>('/payment/capture', {
        method: 'POST',
        body: JSON.stringify({ orderId, providerOrderId }),
      });
      if (capture.status === 'paid') {
        return {
          kind: 'granted' as const,
          title: '\u8d2d\u4e70\u5df2\u786e\u8ba4',
          body: '\u4f60\u5df2\u83b7\u5f97\u89c2\u770b\u6743\u9650\uff0c\u73b0\u5728\u53ef\u4ee5\u76f4\u63a5\u89c2\u770b\u3002',
        };
      }
    } catch {
      // Fall through to entitlement/order checks so the page never overstates success.
    }
  }

  if (courseId) {
    try {
      const entitlement = await requestCheckoutApi<EntitlementResponse>(
        `/entitlements/${courseId}`,
      );
      if (entitlement.has) {
        return {
          kind: 'granted' as const,
          title: '\u8d2d\u4e70\u5df2\u786e\u8ba4',
          body: '\u4f60\u5df2\u83b7\u5f97\u89c2\u770b\u6743\u9650\uff0c\u73b0\u5728\u53ef\u4ee5\u76f4\u63a5\u89c2\u770b\u3002',
        };
      }
    } catch {
      // Ignore auth or transient failures and use order status below.
    }
  }

  if (orderId) {
    try {
      const orders = await requestCheckoutApi<OrdersResponse>('/payment/orders');
      const current = orders.orders.find((order) => order.id === orderId);
      if (current?.status === 'failed') {
        return {
          kind: 'failed' as const,
          title: '\u652f\u4ed8\u672a\u5b8c\u6210',
          body: '\u6211\u4eec\u8fd8\u6ca1\u6709\u786e\u8ba4\u5230\u6700\u7ec8\u4ed8\u6b3e\uff0c\u8bf7\u8fd4\u56de\u8bfe\u7a0b\u9875\u91cd\u8bd5\u3002',
        };
      }
      if (current?.status === 'canceled') {
        return {
          kind: 'canceled' as const,
          title: '\u652f\u4ed8\u5df2\u53d6\u6d88',
          body: '\u8fd9\u7b14\u8ba2\u5355\u6ca1\u6709\u5b8c\u6210\u6263\u6b3e\uff0c\u53ef\u4ee5\u7a0d\u540e\u518d\u6b21\u8d2d\u4e70\u3002',
        };
      }
    } catch {
      // Ignore and fall through to a safe pending state.
    }
  }

  return {
    kind: 'pending' as const,
    title: '\u6b63\u5728\u786e\u8ba4\u652f\u4ed8',
    body: '\u6211\u4eec\u8fd8\u5728\u7b49\u5f85 PayPal \u7684\u6700\u7ec8\u786e\u8ba4\uff0c\u8bf7\u8fd4\u56de\u8bfe\u7a0b\u9875\u7a0d\u540e\u91cd\u8bd5\u3002',
  };
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsRecord>;
}) {
  const params = (await searchParams) ?? {};
  const courseId = getSearchParam(params, 'courseId');
  const orderId = getSearchParam(params, 'orderId');
  const providerOrderId = getSearchParam(params, 'token');

  const state = await resolvePageState(courseId, orderId, providerOrderId);
  const refreshHref = buildCheckoutPageHref('/checkout/success', {
    courseId,
    orderId,
    token: providerOrderId,
  });

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-6 py-10 text-[var(--text-primary)]">
      <div className="glass-shell mx-auto max-w-md p-6">
        <div className="brand-title text-4xl font-semibold">{state.title}</div>
        <div className="mt-2 text-sm text-[var(--text-secondary)]">{state.body}</div>

        <div className="mt-6 flex gap-3">
          {state.kind === 'granted' && courseId ? (
            <Link
              className="action-primary px-3 py-2 text-sm font-medium"
              href={`/watch/${courseId}`}
            >
              {'\u7acb\u5373\u89c2\u770b'}
            </Link>
          ) : null}

          {state.kind !== 'granted' ? (
            <Link
              className="action-primary px-3 py-2 text-sm font-medium"
              href={courseId ? `/courses/${courseId}` : '/'}
            >
              {'\u8fd4\u56de\u8bfe\u7a0b'}
            </Link>
          ) : null}

          {state.kind !== 'granted' ? (
            <Link className="action-ghost px-3 py-2 text-sm font-medium" href={refreshHref}>
              {'\u91cd\u65b0\u786e\u8ba4'}
            </Link>
          ) : null}

          <Link className="action-ghost px-3 py-2 text-sm font-medium" href="/">
            {'\u8fd4\u56de\u9996\u9875'}
          </Link>
        </div>
      </div>
    </div>
  );
}
