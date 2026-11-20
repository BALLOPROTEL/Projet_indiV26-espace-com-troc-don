import { parseAdminCatalogSummary } from './admin-dashboard';
import type {
  AdminProduct,
  AdminProductCreateInput,
  AdminProductImage,
  Cart,
  Listing,
  ListingImage,
  ListingInput,
  ListingStatus,
  MarketplaceProposal,
  MarketplaceTransaction,
  ProposalType,
  Product,
  UserNotification,
} from './types';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

const API_ORIGIN = API_URL.startsWith('http')
  ? new URL(API_URL).origin
  : '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    let message = `La requête a échoué (HTTP ${response.status}).`;

    try {
      const body = (await response.json()) as {
        message?: string | string[];
      };

      if (Array.isArray(body.message)) {
        message = body.message.join(' ');
      } else if (body.message) {
        message = body.message;
      }
    } catch {
      // Keep the fallback error message.
    }

    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

async function requestBlob(
  path: string,
  token: string,
): Promise<Blob> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Impossible de charger l’image (HTTP ${response.status}).`,
    );
  }

  return response.blob();
}

export function apiAssetUrl(path: string): string {
  if (!API_ORIGIN || !path.startsWith('/')) {
    return path;
  }

  return `${API_ORIGIN}${path}`;
}

export function listingAssetUrl(path: string): string {
  return apiAssetUrl(path);
}

export const cartApi = {
  mine: (token: string) =>
    request<Cart>('/cart', {}, token),

  add: (
    token: string,
    input: {
      productId: string;
      variantId: string;
      quantity: number;
    },
  ) =>
    request<Cart>(
      '/cart/items',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      token,
    ),

  updateQuantity: (
    token: string,
    variantId: string,
    quantity: number,
  ) =>
    request<Cart>(
      `/cart/items/${encodeURIComponent(variantId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      },
      token,
    ),

  remove: (token: string, variantId: string) =>
    request<Cart>(
      `/cart/items/${encodeURIComponent(variantId)}`,
      { method: 'DELETE' },
      token,
    ),

  clear: (token: string) =>
    request<Cart>(
      '/cart',
      { method: 'DELETE' },
      token,
    ),
};

export const productsApi = {
  public: (filters: { q?: string; category?: string } = {}) => {
    const params = new URLSearchParams();

    if (filters.q?.trim()) {
      params.set('q', filters.q.trim());
    }
    if (filters.category?.trim()) {
      params.set('category', filters.category.trim());
    }

    const query = params.toString();

    return request<Product[]>(`/products${query ? `?${query}` : ''}`);
  },

  publicBySlug: (slug: string) =>
    request<Product>(`/products/${encodeURIComponent(slug)}`),
};

export const listingsApi = {
  public: () => request<Listing[]>('/listings'),

  publicById: (id: string) =>
    request<Listing>(`/listings/${encodeURIComponent(id)}`),

  mine: (token: string) =>
    request<Listing[]>('/listings/me', {}, token),

  create: (token: string, input: ListingInput) =>
    request<Listing>(
      '/listings',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      token,
    ),

  update: (
    token: string,
    id: string,
    input: Partial<ListingInput>,
  ) =>
    request<Listing>(
      `/listings/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
      token,
    ),

  deleteImages: (token: string, id: string) =>
    request<{ deleted: number }>(
      `/listings/${id}/images`,
      { method: 'DELETE' },
      token,
    ),

  replaceImages: (
    token: string,
    id: string,
    images: File[],
  ) => {
    const body = new FormData();

    for (const image of images) {
      body.append('images', image);
    }

    return request<ListingImage[]>(
      `/listings/${id}/images`,
      {
        method: 'PUT',
        body,
      },
      token,
    );
  },

  authorizedImage: (
    token: string,
    listingId: string,
    imageId: string,
  ) =>
    requestBlob(
      `/listings/${listingId}/images/${imageId}/content/authorized`,
      token,
    ),

  moderation: (
    token: string,
    status: ListingStatus = 'PENDING',
  ) =>
    request<Listing[]>(
      `/moderation/listings?status=${status}`,
      {},
      token,
    ),

  approve: (
    token: string,
    id: string,
    reviewedUpdatedAt: string,
  ) =>
    request<Listing>(
      `/moderation/listings/${id}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ reviewedUpdatedAt }),
      },
      token,
    ),

  reject: (
    token: string,
    id: string,
    reason: string,
    reviewedUpdatedAt: string,
  ) =>
    request<Listing>(
      `/moderation/listings/${id}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason, reviewedUpdatedAt }),
      },
      token,
    ),
};

/** This API is protected by JWT + ADMIN in Catalog; UI role gates are not security. */
export const adminApi = {
  catalogSummary: (token: string) =>
    request<unknown>('/admin/catalog/summary', {}, token).then(parseAdminCatalogSummary),

  products: (token: string) =>
    request<AdminProduct[]>('/admin/products', {}, token),

  createProduct: (
    token: string,
    input: AdminProductCreateInput,
  ) =>
    request<AdminProduct>(
      '/admin/products',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      token,
    ),

  updateProduct: (
    token: string,
    id: string,
    input: Partial<Pick<
      AdminProductCreateInput,
      'slug' | 'name' | 'description' | 'category'
    >>,
  ) =>
    request<AdminProduct>(
      `/admin/products/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
      token,
    ),

  updateProductVariant: (
    token: string,
    productId: string,
    variantId: string,
    input: {
      label?: string;
      priceCents?: number;
      stock?: number;
      active?: boolean;
    },
  ) =>
    request<AdminProduct>(
      `/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
      token,
    ),

  replaceProductImages: (
    token: string,
    productId: string,
    files: File[],
  ) => {
    const body = new FormData();
    for (const file of files) {
      body.append('images', file, file.name);
    }

    return request<AdminProductImage[]>(
      `/admin/products/${encodeURIComponent(productId)}/images`,
      {
        method: 'PUT',
        body,
      },
      token,
    );
  },

  publishProduct: (token: string, id: string) =>
    request<AdminProduct>(
      `/admin/products/${encodeURIComponent(id)}/publish`,
      { method: 'POST' },
      token,
    ),

  archiveProduct: (token: string, id: string) =>
    request<AdminProduct>(
      `/admin/products/${encodeURIComponent(id)}/archive`,
      { method: 'POST' },
      token,
    ),
};

export const favoritesApi = {
  mine: (token: string) =>
    request<Listing[]>('/favorites', {}, token),

  state: (token: string, listingId: string) =>
    request<{ listingId: string; favorited: boolean }>(
      `/favorites/${encodeURIComponent(listingId)}`,
      {},
      token,
    ),

  add: (token: string, listingId: string) =>
    request<{ listingId: string; favorited: boolean }>(
      `/favorites/${encodeURIComponent(listingId)}`,
      { method: 'POST' },
      token,
    ),

  remove: (token: string, listingId: string) =>
    request<{ listingId: string; favorited: boolean }>(
      `/favorites/${encodeURIComponent(listingId)}`,
      { method: 'DELETE' },
      token,
    ),
};

export const notificationsApi = {
  mine: (token: string) =>
    request<UserNotification[]>('/notifications/me', {}, token),
};

export const marketplaceApi = {
  mine: (token: string) =>
    request<MarketplaceProposal[]>('/proposals/me', {}, token),

  received: (token: string) =>
    request<MarketplaceProposal[]>('/proposals/received', {}, token),

  create: (
    token: string,
    input: {
      targetListingId: string;
      type: ProposalType;
      offeredListingId?: string;
      message?: string;
    },
  ) =>
    request<MarketplaceProposal>('/proposals', {
      method: 'POST',
      body: JSON.stringify(input),
    }, token),

  accept: (token: string, id: string) =>
    request<MarketplaceTransaction>(
      `/proposals/${encodeURIComponent(id)}/accept`,
      { method: 'POST' },
      token,
    ),

  reject: (token: string, id: string) =>
    request<MarketplaceProposal>(
      `/proposals/${encodeURIComponent(id)}/reject`,
      { method: 'POST' },
      token,
    ),

  transactions: (token: string) =>
    request<MarketplaceTransaction[]>('/transactions/me', {}, token),

  confirm: (token: string, id: string) =>
    request<MarketplaceTransaction>(
      `/transactions/${encodeURIComponent(id)}/confirm`,
      { method: 'POST' },
      token,
    ),
};
