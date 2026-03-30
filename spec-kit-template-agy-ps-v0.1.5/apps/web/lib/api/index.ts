export type VideoPlaybackPolicy = 'public' | 'signed';

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
    cfStreamVideoId: string | null;
    playbackPolicy: VideoPlaybackPolicy;
    streamStatus: string | null;
    streamReadyToStream: boolean;
    streamThumbnailUrl: string | null;
    durationSeconds: number | null;
  }>;
};

export type PlaybackSourceResponse = {
  provider: 'cloudflare-stream';
  hlsUrl: string;
  dashUrl: string;
  iframeUrl: string;
  thumbnailUrl: string | null;
  playbackPolicy: VideoPlaybackPolicy;
};

export function formatPrice(cents: number, currency: 'USD' | 'EUR') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function normalizeBaseUrl(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function resolveServerRelativeApiUrl(url: string) {
  if (!url.startsWith('/') || typeof window !== 'undefined') return url;

  const originHost = process.env.VERCEL_URL ?? process.env.WEB_BASE_URL?.replace(/^https?:\/\//, '');
  if (!originHost) return url;

  return new URL(url, `https://${originHost}`).toString();
}

export function getCourseApiBaseUrl() {
  const url =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_APP_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://localhost:3001';

  return normalizeBaseUrl(resolveServerRelativeApiUrl(url));
}

export async function apiGet<T>(path: string, init?: RequestInit) {
  const url = `${getCourseApiBaseUrl()}${path}`;
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
  const url = `${getCourseApiBaseUrl()}${path}`;
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
  const url = `${getCourseApiBaseUrl()}${path}`;
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
  const url = `${getCourseApiBaseUrl()}${path}`;
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

