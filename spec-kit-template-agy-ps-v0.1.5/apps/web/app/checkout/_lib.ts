import { cookies } from 'next/headers';
import { getCourseApiBaseUrl } from '../../lib/api';

type SearchParamsRecord = Record<string, string | string[] | undefined>;

export function getSearchParam(params: SearchParamsRecord, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function buildCheckoutPageHref(
  path: '/checkout/success' | '/checkout/cancel',
  params: Record<string, string | undefined>,
) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export async function requestCheckoutApi<T>(path: string, init?: RequestInit) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const res = await fetch(`${getCourseApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.message === 'string' ? data.message : 'Request failed');
  }
  return data as T;
}
