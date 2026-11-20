import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CatalogProductVariantSnapshot } from './catalog-contract';

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
