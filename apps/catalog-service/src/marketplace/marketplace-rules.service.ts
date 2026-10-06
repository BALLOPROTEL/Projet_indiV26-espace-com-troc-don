import { BadRequestException, Injectable } from '@nestjs/common';
import { ListingOperationType } from '../../generated/prisma';

export const MIN_LISTING_IMAGES = 5;
export const MAX_LISTING_IMAGES = 8;
export const MIN_TRADE_WISHES = 5;
export const MAX_TRADE_WISHES = 10;

@Injectable()
export class MarketplaceRulesService {
  validatePublicationAssets(
    operationType: ListingOperationType,
    imageCount: number,
    tradeWishes: string[],
  ): string[] {
    this.assertImageCount(imageCount);
    return this.validateTradeWishes(operationType, tradeWishes);
  }

  validateTradeWishes(
    operationType: ListingOperationType,
    tradeWishes: string[],
  ): string[] {
    const normalizedWishes = this.normalizeTradeWishes(tradeWishes);

    if (operationType === ListingOperationType.DONATION) {
      if (normalizedWishes.length > 0) {
        throw new BadRequestException(
          'A donation listing cannot define trade wishes',
        );
      }
      return [];
    }

    if (normalizedWishes.length < MIN_TRADE_WISHES) {
      throw new BadRequestException(
        `A trade listing requires at least ${MIN_TRADE_WISHES} distinct wishes`,
      );
    }

    if (normalizedWishes.length > MAX_TRADE_WISHES) {
      throw new BadRequestException(
        `A trade listing accepts at most ${MAX_TRADE_WISHES} wishes`,
      );
    }

    return normalizedWishes;
  }

  normalizeTradeWishes(tradeWishes: string[]): string[] {
    const normalized: string[] = [];
    const seen = new Set<string>();

    for (const rawWish of tradeWishes) {
      const wish = rawWish.trim();
      if (!wish) {
        continue;
      }

      const key = wish.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      normalized.push(wish);
    }

    return normalized;
  }

  private assertImageCount(imageCount: number): void {
    if (
      !Number.isInteger(imageCount) ||
      imageCount < MIN_LISTING_IMAGES ||
      imageCount > MAX_LISTING_IMAGES
    ) {
      throw new BadRequestException(
        `A listing requires between ${MIN_LISTING_IMAGES} and ${MAX_LISTING_IMAGES} images`,
      );
    }
  }
}
