export type GatewayTarget =
  | 'gateway'
  | 'catalog'
  | 'marketplace'
  | 'legacy';

export type GatewayRoute = {
  target: GatewayTarget;
  upstreamPath: string;
};

function stripApiPrefix(path: string): string {
  const stripped = path.replace(/^\/api(?=\/|$)/, '');
  return stripped || '/';
}

export function resolveGatewayRoute(
  requestUrl: string,
): GatewayRoute | null {
  const url = new URL(requestUrl, 'http://gateway.local');
  const path = url.pathname;

  if (
    path === '/api/health/live' ||
    path === '/api/health/ready'
  ) {
    return {
      target: 'gateway',
      upstreamPath: `${path}${url.search}`,
    };
  }

  if (
    path === '/api/listings' ||
    path.startsWith('/api/listings/') ||
    path === '/api/moderation/listings' ||
    path.startsWith('/api/moderation/listings/')
  ) {
    return {
      target: 'catalog',
      upstreamPath: `${stripApiPrefix(path)}${url.search}`,
    };
  }

  if (
    path === '/api/proposals' ||
    path.startsWith('/api/proposals/') ||
    path === '/api/transactions' ||
    path.startsWith('/api/transactions/')
  ) {
    return {
      target: 'marketplace',
      upstreamPath: `${stripApiPrefix(path)}${url.search}`,
    };
  }

  if (
    path === '/api/auth' ||
    path.startsWith('/api/auth/') ||
    path === '/api/metrics'
  ) {
    return {
      target: 'legacy',
      upstreamPath: `${path}${url.search}`,
    };
  }

  return null;
}
