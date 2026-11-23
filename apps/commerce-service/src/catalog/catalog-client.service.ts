import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CatalogProductVariantSnapshot,
  CatalogStockReservation,
} from './catalog-contract';

@Injectable()
export class CatalogClientService {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(private readonly config: ConfigService) {
    const baseUrl = this.config
      .get<string>('CATALOG_INTERNAL_URL')
      ?.trim();
    const token = this.config
      .get<string>('INTERNAL_SERVICE_TOKEN')
      ?.trim();

    if (!baseUrl || !token) {
      throw new Error(
        'CATALOG_INTERNAL_URL and INTERNAL_SERVICE_TOKEN must be configured',
      );
    }

    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  async getProductVariant(
    productId: string,
    variantId: string,
  ): Promise<CatalogProductVariantSnapshot> {
    let response: Response;

    try {
      response = await fetch(
        `${this.baseUrl}/internal/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
        {
          headers: {
            'x-internal-service-token': this.token,
          },
          signal: AbortSignal.timeout(3000),
        },
      );
    } catch {
      throw new BadGatewayException(
        'Catalog Service is unavailable',
      );
    }

    if (response.status === 404) {
      throw new NotFoundException(
        'Product variant not found',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `Catalog Service returned HTTP ${response.status}`,
      );
    }

    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new BadGatewayException(
        'Invalid Catalog product response',
      );
    }

    if (!this.isSnapshot(value)) {
      throw new BadGatewayException(
        'Invalid Catalog product response',
      );
    }

    return value;
  }

  async reserveStock(
    orderId: string,
    items: Array<{
      productId: string;
      variantId: string;
      quantity: number;
    }>,
  ): Promise<CatalogStockReservation> {
    return this.requestReservation(
      '/internal/product-stock-reservations',
      {
        method: 'POST',
        body: JSON.stringify({ orderId, items }),
      },
    );
  }

  async extendStock(
    orderId: string,
  ): Promise<CatalogStockReservation> {
    return this.requestReservation(
      `/internal/product-stock-reservations/${encodeURIComponent(orderId)}/extend`,
      { method: 'POST' },
    );
  }

  async releaseStock(
    orderId: string,
  ): Promise<CatalogStockReservation> {
    return this.requestReservation(
      `/internal/product-stock-reservations/${encodeURIComponent(orderId)}/release`,
      { method: 'POST' },
    );
  }

  async commitStock(
    orderId: string,
  ): Promise<CatalogStockReservation> {
    return this.requestReservation(
      `/internal/product-stock-reservations/${encodeURIComponent(orderId)}/commit`,
      { method: 'POST' },
    );
  }

  private async requestReservation(
    path: string,
    options: RequestInit,
  ): Promise<CatalogStockReservation> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          'content-type': 'application/json',
          'x-internal-service-token': this.token,
          ...(options.headers ?? {}),
        },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new BadGatewayException(
        'Catalog Service is unavailable',
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (response.status === 404) {
      throw new NotFoundException(
        'Catalog stock reservation not found',
      );
    }

    if (response.status === 409) {
      throw new ConflictException(
        'Catalog stock reservation conflict',
      );
    }

    if (!response.ok || !this.isReservation(body)) {
      throw new BadGatewayException(
        `Catalog stock reservation returned HTTP ${response.status}`,
      );
    }

    return body;
  }

  private isReservation(
    value: unknown,
  ): value is CatalogStockReservation {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const item = value as Record<string, unknown>;
    return (
      typeof item.id === 'string' &&
      typeof item.orderId === 'string' &&
      ['ACTIVE', 'RELEASED', 'EXPIRED', 'COMMITTED'].includes(
        String(item.status),
      ) &&
      typeof item.expiresAt === 'string' &&
      Array.isArray(item.items)
    );
  }

  private isSnapshot(
    value: unknown,
  ): value is CatalogProductVariantSnapshot {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const item = value as Record<string, unknown>;

    return (
      typeof item.productId === 'string' &&
      typeof item.slug === 'string' &&
      typeof item.name === 'string' &&
      item.currency === 'EUR' &&
      ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(
        String(item.status),
      ) &&
      typeof item.variantId === 'string' &&
      typeof item.variantLabel === 'string' &&
      Number.isSafeInteger(item.priceCents) &&
      Number(item.priceCents) > 0 &&
      Number.isSafeInteger(item.stock) &&
      Number(item.stock) >= 0 &&
      typeof item.active === 'boolean' &&
      (item.primaryImageId === null ||
        typeof item.primaryImageId === 'string')
    );
  }
}
