import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  Listing,
  ListingAvailabilityStatus,
  ListingOperationType,
  ListingStatus,
  MarketplaceTransaction,
  MarketplaceTransactionStatus,
  ProposalStatus,
} from '@prisma/client';

export const MIN_LISTING_IMAGES = 5;
export const MAX_LISTING_IMAGES = 8;
export const MIN_TRADE_WISHES = 5;
export const MAX_TRADE_WISHES = 10;

export type MarketplaceListing = Pick<
  Listing,
  | 'id'
  | 'ownerId'
  | 'operationType'
  | 'status'
  | 'availabilityStatus'
>;

type TransactionIdentity = Pick<
  MarketplaceTransaction,
  'ownerId' | 'requesterId' | 'status'
>;

@Injectable()
export class MarketplaceRulesService {
  validatePublicationAssets(
    operationType: ListingOperationType,
    imageCount: number,
    tradeWishes: string[],
  ): string[] {
    this.assertImageCount(imageCount);

    return this.validateTradeWishes(
      operationType,
      tradeWishes,
    );
  }

  validateTradeWishes(
    operationType: ListingOperationType,
    tradeWishes: string[],
  ): string[] {
    const normalizedWishes =
      this.normalizeTradeWishes(tradeWishes);

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

  assertCanRequestDonation(
    target: MarketplaceListing,
    requesterId: string,
  ): void {
    this.assertTargetCanReceiveProposal(target, requesterId);

    if (
      target.operationType !== ListingOperationType.DONATION
    ) {
      throw new BadRequestException(
        'Donation requests are only allowed on donation listings',
      );
    }
  }

  assertCanOfferTrade(
    target: MarketplaceListing,
    offered: MarketplaceListing,
    requesterId: string,
  ): void {
    this.assertTargetCanReceiveProposal(target, requesterId);

    if (target.operationType !== ListingOperationType.TRADE) {
      throw new BadRequestException(
        'Trade offers are only allowed on trade listings',
      );
    }

    if (offered.id === target.id) {
      throw new BadRequestException(
        'The offered listing must differ from the target listing',
      );
    }

    if (offered.ownerId !== requesterId) {
      throw new ForbiddenException(
        'Only the owner may offer this listing in a trade',
      );
    }

    if (offered.operationType !== ListingOperationType.TRADE) {
      throw new BadRequestException(
        'Only a trade listing may be offered as a trade counterpart',
      );
    }

    this.assertApprovedAndAvailable(
      offered,
      'The offered listing',
    );
  }

  assertProposalCanBeAccepted(
    target: MarketplaceListing,
    proposalStatus: ProposalStatus,
    offered?: MarketplaceListing,
  ): void {
    this.assertApprovedAndAvailable(
      target,
      'The target listing',
    );

    if (proposalStatus !== ProposalStatus.PENDING) {
      throw new ConflictException(
        'Only a pending proposal can be accepted',
      );
    }

    if (offered) {
      this.assertApprovedAndAvailable(
        offered,
        'The offered listing',
      );
    }
  }

  assertCanConfirmTransaction(
    transaction: TransactionIdentity,
    actorId: string,
  ): void {
    if (
      transaction.status !==
      MarketplaceTransactionStatus.IN_PROGRESS
    ) {
      throw new ConflictException(
        'Only an in-progress transaction can be confirmed',
      );
    }

    if (
      actorId !== transaction.ownerId &&
      actorId !== transaction.requesterId
    ) {
      throw new ForbiddenException(
        'Only transaction participants can confirm it',
      );
    }
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

  private assertTargetCanReceiveProposal(
    target: MarketplaceListing,
    requesterId: string,
  ): void {
    if (target.ownerId === requesterId) {
      throw new ForbiddenException(
        'A user cannot make a proposal on their own listing',
      );
    }

    this.assertApprovedAndAvailable(
      target,
      'The target listing',
    );
  }

  private assertApprovedAndAvailable(
    listing: MarketplaceListing,
    label: string,
  ): void {
    if (listing.status !== ListingStatus.APPROVED) {
      throw new ConflictException(
        `${label} must be approved`,
      );
    }

    if (
      listing.availabilityStatus !==
      ListingAvailabilityStatus.AVAILABLE
    ) {
      throw new ConflictException(
        `${label} is not available`,
      );
    }
  }
}
