export type CourseListItem = {
  id: string;
  title: string;
  description: string;
  cuisine: string | null;
  difficulty: string | null;
  priceCents: number;
  priceCentsUsd: number | null;
  priceCentsEur: number | null;
  currency: string;
  coverImageUrl: string | null;
};

export type CourseDetail = CourseListItem & {
  videos: Array<{
    id: string;
    title: string;
    durationSeconds: number | null;
  }>;
};

export type AdminCourse = CourseListItem & {
  isPublished: boolean;
  videos: Array<{
    id: string;
    title: string;
    sourceUrl: string;
    durationSeconds: number | null;
  }>;
};

export function formatPrice(cents: number, currency: 'USD' | 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function getApiBaseUrl() {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_API_BASE_URL is required');
  return url;
}

export async function apiGet<T>(path: string, init?: RequestInit) {
  const url = `${getApiBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: init?.cache ?? 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? 'Request failed');
  return data as T;
}

export async function apiPost<T>(path: string, body?: unknown, init?: RequestInit) {
  const url = `${getApiBaseUrl()}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? 'Request failed');
  return data as T;
}

export async function apiPatch<T>(path: string, body?: unknown, init?: RequestInit) {
  const url = `${getApiBaseUrl()}${path}`;
  const res = await fetch(url, {
    method: 'PATCH',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? 'Request failed');
  return data as T;
}

export async function apiDelete<T>(path: string, init?: RequestInit) {
  const url = `${getApiBaseUrl()}${path}`;
  const res = await fetch(url, {
    method: 'DELETE',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? 'Request failed');
  return data as T;
}

