import { resolveRequestWebBaseUrl } from './env';

const fallback = 'https://fallback.example.com';
const allowedOrigins = [
  fallback,
  'https://preview.example.com',
  'https://feature-branch.example.vercel.app',
  'http://127.0.0.1:3000',
];

describe('resolveRequestWebBaseUrl', () => {
  it('prefers the request origin header when available', () => {
    const result = resolveRequestWebBaseUrl(
      {
        headers: {
          origin: 'https://preview.example.com',
        },
      },
      { fallback, allowedOrigins },
    );

    expect(result).toBe('https://preview.example.com');
  });

  it('reconstructs the origin from forwarded host headers', () => {
    const result = resolveRequestWebBaseUrl(
      {
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'feature-branch.example.vercel.app',
        },
      },
      { fallback, allowedOrigins },
    );

    expect(result).toBe('https://feature-branch.example.vercel.app');
  });

  it('falls back to localhost inference when only the host header exists', () => {
    const result = resolveRequestWebBaseUrl(
      {
        headers: {
          host: '127.0.0.1:3000',
        },
      },
      { fallback, allowedOrigins },
    );

    expect(result).toBe('http://127.0.0.1:3000');
  });

  it('falls back when the origin header is not allowlisted', () => {
    const result = resolveRequestWebBaseUrl(
      {
        headers: {
          origin: 'https://evil.example.com',
        },
      },
      { fallback, allowedOrigins },
    );

    expect(result).toBe(fallback);
  });

  it('falls back when forwarded host headers point to an unknown domain', () => {
    const result = resolveRequestWebBaseUrl(
      {
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'evil.example.com',
        },
      },
      { fallback, allowedOrigins },
    );

    expect(result).toBe(fallback);
  });
});
