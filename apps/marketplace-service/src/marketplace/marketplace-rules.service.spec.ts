import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  MarketplaceTransactionStatus,
  ProposalStatus,
} from '../../generated/prisma';
import {
  CatalogListingSnapshot,
  ListingAvailabilityStatus,
  ListingOperationType,
  ListingStatus,
} from '../catalog/catalog-contract';
import { MarketplaceRulesService } from './marketplace-rules.service';

describe('MarketplaceRulesService', () => {
  const rules = new MarketplaceRulesService();
  const listing = (
    overrides: Partial<CatalogListingSnapshot> = {},
  ): CatalogListingSnapshot => ({
    id: 'target-1',
    ownerId: 'owner-1',
    operationType: ListingOperationType.DONATION,
    status: ListingStatus.APPROVED,
    availabilityStatus: ListingAvailabilityStatus.AVAILABLE,
    ...overrides,
  });

  it('accepts a donation request from another user', () => {
    expect(() =>
      rules.assertCanRequestDonation(listing(), 'requester-1'),
    ).not.toThrow();
  });

  it('blocks proposals on your own listing', () => {
    expect(() =>
      rules.assertCanRequestDonation(listing(), 'owner-1'),
    ).toThrow(ForbiddenException);
  });

  it('blocks donation requests on trade listings', () => {
    expect(() =>
      rules.assertCanRequestDonation(
        listing({ operationType: ListingOperationType.TRADE }),
        'requester-1',
      ),
    ).toThrow(BadRequestException);
  });

  it('requires approved and available listings', () => {
    expect(() =>
      rules.assertCanRequestDonation(
        listing({ status: ListingStatus.PENDING }),
        'requester-1',
      ),
    ).toThrow(ConflictException);

    expect(() =>
      rules.assertCanRequestDonation(
        listing({
          availabilityStatus: ListingAvailabilityStatus.RESERVED,
        }),
        'requester-1',
      ),
    ).toThrow(ConflictException);
  });

  it('validates the requester trade counterpart', () => {
    const target = listing({
      operationType: ListingOperationType.TRADE,
    });
    const offered = listing({
      id: 'offer-1',
      ownerId: 'requester-1',
      operationType: ListingOperationType.TRADE,
    });

    expect(() =>
      rules.assertCanOfferTrade(target, offered, 'requester-1'),
    ).not.toThrow();

    expect(() =>
      rules.assertCanOfferTrade(
        target,
        { ...offered, ownerId: 'someone-else' },
        'requester-1',
      ),
    ).toThrow(ForbiddenException);
  });

  it('accepts only pending proposals', () => {
    expect(() =>
      rules.assertProposalCanBeAccepted(
        listing(),
        ProposalStatus.ACCEPTED,
      ),
    ).toThrow(ConflictException);
  });

  it('allows only transaction participants to confirm', () => {
    const transaction = {
      ownerId: 'owner-1',
      requesterId: 'requester-1',
      status: MarketplaceTransactionStatus.IN_PROGRESS,
    };

    expect(() =>
      rules.assertCanConfirmTransaction(transaction, 'owner-1'),
    ).not.toThrow();
    expect(() =>
      rules.assertCanConfirmTransaction(transaction, 'intruder'),
    ).toThrow(ForbiddenException);
  });
});
