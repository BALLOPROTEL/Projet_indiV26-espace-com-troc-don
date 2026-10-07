import type { ServerResponse } from 'node:http';

export function applySecurityHeaders(
  response: Pick<ServerResponse, 'removeHeader' | 'setHeader'>,
): void {
  response.removeHeader('X-Powered-By');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader(
    'Referrer-Policy',
    'strict-origin-when-cross-origin',
  );
  response.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
}
