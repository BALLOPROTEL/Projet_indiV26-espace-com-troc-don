export type GatewayTarget =
  | 'gateway'
  | 'catalog'
  | 'marketplace'
  | 'notification'
  | 'commerce'
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
    path === '/api/health/ready' ||
    path === '/api/metrics'
  ) {
    return {
      target: 'gateway',
      upstreamPath: `${path}${url.search}`,
    };
  }

  // Explicit ADMIN-only routes. Do not forward /api/admin/* broadly.
  if (path === '/api/admin/catalog/summary') {
    return {
      target: 'catalog',
      upstreamPath: `/admin/catalog/summary${url.search}`,
    };
  }

  if (
    path === '/api/admin/products' ||
    path.startsWith('/api/admin/products/')
  ) {
    return {
      target: 'catalog',
      upstreamPath: `${stripApiPrefix(path)}${url.search}`,
    };
  }

  if (
    path === '/api/products' ||
    path.startsWith('/api/products/')
  ) {
    return {
      target: 'catalog',
      upstreamPath: `${stripApiPrefix(path)}${url.search}`,
    };
  }

  if (
    path === '/api/listings' ||
    path.startsWith('/api/listings/') ||
    path === '/api/favorites' ||
    path.startsWith('/api/favorites/') ||
    path === '/api/moderation/listings' ||
    path.startsWith('/api/moderation/listings/') ||
    path === '/api/moderation/reports' ||
    path.startsWith('/api/moderation/reports/')
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
    path.startsWith('/api/transactions/') ||
    path === '/api/conversations' ||
    path.startsWith('/api/conversations/')
  ) {
    return {
      target: 'marketplace',
      upstreamPath: `${stripApiPrefix(path)}${url.search}`,
    };
  }

  if (path === '/api/payments/stripe/webhook') {
    return {
      target: 'commerce',
      upstreamPath: '/payments/stripe/webhook',
    };
  }

  if (
    path === '/api/cart' ||
    path.startsWith('/api/cart/') ||
    path === '/api/orders' ||
    path.startsWith('/api/orders/')
  ) {
    return {
      target: 'commerce',
      upstreamPath: `${stripApiPrefix(path)}${url.search}`,
    };
  }

  // Expose only the authenticated user inbox. The global technical
  // /notifications/recent endpoint stays unreachable through the Gateway.
  if (path === '/api/notifications/me') {
    return {
      target: 'notification',
      upstreamPath: `/notifications/me${url.search}`,
    };
  }

  if (
    path === '/api/auth' ||
    path.startsWith('/api/auth/')
  ) {
    return {
      target: 'legacy',
      upstreamPath: `${path}${url.search}`,
    };
  }

  return null;
}
