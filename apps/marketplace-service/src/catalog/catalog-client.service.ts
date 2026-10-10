import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CatalogListingSnapshot,
  ListingAvailabilityStatus,
  ListingOperationType,
  ListingStatus,
} from './catalog-contract';

@Injectable()
export class CatalogClientService {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(private readonly config: ConfigService) {
    const baseUrl = this.config.get<string>('CATALOG_INTERNAL_URL')?.trim();
    const token = this.config.get<string>('INTERNAL_SERVICE_TOKEN')?.trim();

    if (!baseUrl || !token) {
      throw new Error(
        'CATALOG_INTERNAL_URL and INTERNAL_SERVICE_TOKEN must be configured',
      );
    }

    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  async getOwnerListingIds(ownerId: string): Promise<string[]> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/internal/listings/owner/${encodeURIComponent(ownerId)}/ids`,
        {
          headers: { 'x-internal-service-token': this.token },
          signal: AbortSignal.timeout(3000),
        },
      );
    } catch {
      throw new BadGatewayException('Catalog Service is unavailable');
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `Catalog Service returned HTTP ${response.status}`,
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new BadGatewayException('Invalid owner listings response');
    }
    if (!Array.isArray(data) || !data.every((id) => typeof id === 'string')) {
      throw new BadGatewayException('Invalid owner listings response');
    }

    return data as string[];
  }

  getListing(id: string): Promise<CatalogListingSnapshot> {
    return this.requestListing('GET', id);
  }

  reserveListing(id: string): Promise<CatalogListingSnapshot> {
    return this.requestListing('POST', id, 'reserve');
  }

  completeListing(id: string): Promise<CatalogListingSnapshot> {
    return this.requestListing('POST', id, 'complete');
  }

  releaseListing(id: string): Promise<CatalogListingSnapshot> {
    return this.requestListing('POST', id, 'release');
  }

  private async requestListing(
    method: 'GET' | 'POST',
    id: string,
    action?: 'reserve' | 'complete' | 'release',
  ): Promise<CatalogListingSnapshot> {
    const suffix = action ? `/${action}` : '';
    let response: Response;

    try {
      response = await fetch(
        `${this.baseUrl}/internal/listings/${encodeURIComponent(id)}${suffix}`,
        {
          method,
          headers: {
            'x-internal-service-token': this.token,
          },
          signal: AbortSignal.timeout(3000),
        },
      );
    } catch {
      throw new BadGatewayException('Catalog Service is unavailable');
    }

    if (response.status === 404) {
      throw new NotFoundException('Listing not found');
    }

    if (response.status === 409) {
      throw new ConflictException('Catalog listing state conflict');
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `Catalog Service returned HTTP ${response.status}`,
      );
    }

    const value = (await response.json()) as unknown;

    if (!this.isSnapshot(value)) {
      throw new BadGatewayException('Invalid Catalog Service response');
    }

    return value;
  }

  private isSnapshot(value: unknown): value is CatalogListingSnapshot {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const item = value as Record<string, unknown>;

    return (
      typeof item.id === 'string' &&
      typeof item.ownerId === 'string' &&
      Object.values(ListingOperationType).includes(
        item.operationType as never,
      ) &&
      Object.values(ListingStatus).includes(item.status as never) &&
      Object.values(ListingAvailabilityStatus).includes(
        item.availabilityStatus as never,
      )
    );
  }
}
