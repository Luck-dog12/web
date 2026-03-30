export type AppEnv = {
  port: number;
  webBaseUrl: string;
  webBaseUrls: string[];
  sessionSecret: string;
  databaseUrl: string;
  redisUrl?: string;
  isProduction: boolean;
  secureCookies: boolean;
  sessionTtlSeconds: number;
};

type RequestBaseUrlSource = {
  headers?: Record<string, string | string[] | undefined>;
  protocol?: string;
  get?: (name: string) => string | undefined;
};

type ResolveRequestWebBaseUrlOptions = {
  fallback: string;
  allowedOrigins: string[];
};

const DEFAULT_WEB_BASE_URL = 'http://localhost:3000';

function parseBoolean(value: string | undefined) {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function getHeaderValue(source: RequestBaseUrlSource, name: string) {
  const lowerName = name.toLowerCase();
  const getterValue = source.get?.(lowerName) ?? source.get?.(name);
  if (getterValue) return getterValue;

  const value = source.headers?.[lowerName] ?? source.headers?.[name];
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeOrigin(value: string | undefined) {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function normalizeOrigins(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeOrigin(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function getDefaultWebBaseUrls(configuredWebBaseUrl: string) {
  const normalizedWebBaseUrl =
    normalizeOrigin(configuredWebBaseUrl) ?? DEFAULT_WEB_BASE_URL;
  const defaults = [normalizedWebBaseUrl];
  const parsed = new URL(normalizedWebBaseUrl);
  if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
    const alternate = new URL(normalizedWebBaseUrl);
    alternate.hostname =
      parsed.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    defaults.push(alternate.origin);
  }
  return defaults;
}

function buildForwardedOrigin(source: RequestBaseUrlSource) {
  const forwardedProto = getHeaderValue(source, 'x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  const forwardedHost = getHeaderValue(source, 'x-forwarded-host')
    ?.split(',')[0]
    ?.trim();
  if (!forwardedHost) return undefined;
  return normalizeOrigin(
    `${forwardedProto ?? source.protocol ?? 'https'}://${forwardedHost}`,
  );
}

function buildHostOrigin(source: RequestBaseUrlSource) {
  const forwardedProto = getHeaderValue(source, 'x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  const host = getHeaderValue(source, 'host')?.trim();
  if (!host) return undefined;
  const inferredProto =
    forwardedProto ??
    source.protocol ??
    (host.includes('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : 'https');
  return normalizeOrigin(`${inferredProto}://${host}`);
}

export function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
  if (databaseUrl) return databaseUrl;
  throw new Error('DATABASE_URL or DIRECT_URL is required');
}

export function getAppEnv(): AppEnv {
  const port = Number(process.env.PORT ?? 3001);
  const configuredWebBaseUrl =
    normalizeOrigin(process.env.WEB_BASE_URL ?? DEFAULT_WEB_BASE_URL) ??
    DEFAULT_WEB_BASE_URL;
  const vercelWebBaseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : undefined;
  const defaultWebBaseUrls = getDefaultWebBaseUrls(configuredWebBaseUrl);
  const webBaseUrls = (
    process.env.WEB_BASE_URLS ?? defaultWebBaseUrls.join(',')
  )
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const normalizedWebBaseUrls = normalizeOrigins(webBaseUrls);
  if (
    vercelWebBaseUrl &&
    !normalizedWebBaseUrls.includes(vercelWebBaseUrl)
  ) {
    normalizedWebBaseUrls.push(vercelWebBaseUrl);
  }
  const webBaseUrl = normalizedWebBaseUrls[0] ?? configuredWebBaseUrl;
  const sessionSecret = process.env.SESSION_SECRET ?? 'dev-session-secret';
  const databaseUrl = getDatabaseUrl();
  const redisUrl = process.env.REDIS_URL || undefined;
  const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';
  const secureCookies =
    parseBoolean(process.env.SESSION_COOKIE_SECURE) ??
    (isProduction || webBaseUrl.startsWith('https://'));
  const configuredSessionTtlSeconds = Number(
    process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 7,
  );
  const sessionTtlSeconds =
    Number.isFinite(configuredSessionTtlSeconds) &&
    configuredSessionTtlSeconds > 0
      ? configuredSessionTtlSeconds
      : 60 * 60 * 24 * 7;

  return {
    port,
    webBaseUrl,
    webBaseUrls: normalizedWebBaseUrls,
    sessionSecret,
    databaseUrl,
    redisUrl,
    isProduction,
    secureCookies,
    sessionTtlSeconds,
  };
}

export function resolveRequestWebBaseUrl(
  source: RequestBaseUrlSource,
  options?: Partial<ResolveRequestWebBaseUrlOptions>,
) {
  const env =
    options?.fallback && options?.allowedOrigins ? undefined : getAppEnv();
  const fallback =
    normalizeOrigin(options?.fallback) ??
    env?.webBaseUrl ??
    DEFAULT_WEB_BASE_URL;
  const allowedOrigins = normalizeOrigins([
    ...(options?.allowedOrigins ?? env?.webBaseUrls ?? []),
    fallback,
  ]);
  const allowedOriginSet = new Set(allowedOrigins);
  const candidates = normalizeOrigins([
    getHeaderValue(source, 'origin') ?? '',
    getHeaderValue(source, 'referer') ?? '',
    buildForwardedOrigin(source) ?? '',
    buildHostOrigin(source) ?? '',
  ]);

  for (const candidate of candidates) {
    if (allowedOriginSet.has(candidate)) return candidate;
  }

  return fallback;
}
