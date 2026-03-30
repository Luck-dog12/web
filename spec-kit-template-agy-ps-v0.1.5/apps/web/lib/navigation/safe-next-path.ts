export function sanitizeNextPath(input: string | undefined, fallbackPath: string) {
  if (!input) return fallbackPath;

  const trimmed = input.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallbackPath;
  }

  try {
    const parsed = new URL(trimmed, 'https://app.local');
    if (parsed.origin !== 'https://app.local') {
      return fallbackPath;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallbackPath;
  }
}
