const FALLBACK_SITE_URL = 'http://localhost:3001';

export function getSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  try {
    const url = new URL(configured || FALLBACK_SITE_URL);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Unsupported site URL protocol');
    }
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url;
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}
