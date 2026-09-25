import type {
  Listing,
  ListingInput,
  ListingStatus,
} from './types';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

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

  if (options.body) {
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

  moderation: (
    token: string,
    status: ListingStatus = 'PENDING',
  ) =>
    request<Listing[]>(
      `/moderation/listings?status=${status}`,
      {},
      token,
    ),

  approve: (token: string, id: string) =>
    request<Listing>(
      `/moderation/listings/${id}/approve`,
      { method: 'POST' },
      token,
    ),

  reject: (token: string, id: string, reason: string) =>
    request<Listing>(
      `/moderation/listings/${id}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      },
      token,
    ),
};
