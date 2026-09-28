import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ListingAvailabilityStatus,
  ListingOperationType,
  ListingStatus,
  MarketplaceTransactionStatus,
  ProposalStatus,
} from '@prisma/client';
import {
  MarketplaceListing,
  MarketplaceRulesService,
} from './marketplace-rules.service';

describe('MarketplaceRulesService', () => {
  const rules = new MarketplaceRulesService();

  const listing = (
    overrides: Partial<MarketplaceListing> = {},
  ): MarketplaceListing => ({
    id: 'listing-target',
    ownerId: 'owner-a',
    operationType: ListingOperationType.TRADE,
    status: ListingStatus.APPROVED,
    availabilityStatus:
      ListingAvailabilityStatus.AVAILABLE,
    ...overrides,
  });

  it('normalizes trade wishes while preserving first occurrence order', () => {
    expect(
      rules.normalizeTradeWishes([
        ' Nintendo Switch ',
        '',
        'Steam Deck',
        'nintendo switch',
        '  ',
      ]),
    ).toEqual(['Nintendo Switch', 'Steam Deck']);
  });

  it('uses locale-independent case folding for duplicate wishes', () => {
    expect(
      rules.normalizeTradeWishes(['I', 'i', 'Console']),
    ).toEqual(['I', 'Console']);
  });

  it('accepts a trade publication with 5 to 8 images and 5 distinct wishes', () => {
    expect(
      rules.validatePublicationAssets(
        ListingOperationType.TRADE,
        5,
        [
          'Nintendo Switch',
          'Steam Deck',
          'Tablet',
          'Laptop',
          'Gaming monitor',
        ],
      ),
    ).toHaveLength(5);
  });

  it('rejects an invalid image count', () => {
    expect(() =>
      rules.validatePublicationAssets(
        ListingOperationType.DONATION,
        4,
        [],
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      rules.validatePublicationAssets(
        ListingOperationType.DONATION,
        9,
        [],
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects fewer than 5 distinct trade wishes', () => {
    expect(() =>
      rules.validatePublicationAssets(
        ListingOperationType.TRADE,
        5,
        ['A', 'B', 'C', 'D', 'a'],
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects more than 10 trade wishes', () => {
    expect(() =>
      rules.validatePublicationAssets(
        ListingOperationType.TRADE,
        5,
        Array.from({ length: 11 }, (_, index) => `Wish ${index}`),
      ),
    ).toThrow(BadRequestException);
  });

  it('forbids trade wishes on a donation listing', () => {
    expect(() =>
      rules.validatePublicationAssets(
        ListingOperationType.DONATION,
        5,
        ['Nintendo Switch'],
      ),
    ).toThrow(BadRequestException);
  });

  it('allows another user to request an approved available donation', () => {
    expect(() =>
      rules.assertCanRequestDonation(
        listing({
          operationType: ListingOperationType.DONATION,
        }),
        'requester-b',
      ),
    ).not.toThrow();
  });

  it('rejects donation requests on own, trade, pending or reserved listings', () => {
    expect(() =>
      rules.assertCanRequestDonation(
        listing({
          operationType: ListingOperationType.DONATION,
        }),
        'owner-a',
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      rules.assertCanRequestDonation(
        listing(),
        'requester-b',
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      rules.assertCanRequestDonation(
        listing({
          operationType: ListingOperationType.DONATION,
          status: ListingStatus.PENDING,
        }),
        'requester-b',
      ),
    ).toThrow(ConflictException);

    expect(() =>
      rules.assertCanRequestDonation(
        listing({
          operationType: ListingOperationType.DONATION,
          availabilityStatus:
            ListingAvailabilityStatus.RESERVED,
        }),
        'requester-b',
      ),
    ).toThrow(ConflictException);
  });

  it('allows a valid trade offer owned by the requester', () => {
    expect(() =>
      rules.assertCanOfferTrade(
        listing(),
        listing({
          id: 'listing-offered',
          ownerId: 'requester-b',
        }),
        'requester-b',
      ),
    ).not.toThrow();
  });

  it('rejects invalid trade counterparts', () => {
    expect(() =>
      rules.assertCanOfferTrade(
        listing({
          operationType: ListingOperationType.DONATION,
        }),
        listing({
          id: 'listing-offered',
          ownerId: 'requester-b',
        }),
        'requester-b',
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      rules.assertCanOfferTrade(
        listing(),
        listing({
          id: 'listing-target',
          ownerId: 'requester-b',
        }),
        'requester-b',
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      rules.assertCanOfferTrade(
        listing(),
        listing({
          id: 'listing-offered',
          ownerId: 'someone-else',
        }),
        'requester-b',
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      rules.assertCanOfferTrade(
        listing(),
        listing({
          id: 'listing-offered',
          ownerId: 'requester-b',
          operationType: ListingOperationType.DONATION,
        }),
        'requester-b',
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      rules.assertCanOfferTrade(
        listing(),
        listing({
          id: 'listing-offered',
          ownerId: 'requester-b',
          availabilityStatus:
            ListingAvailabilityStatus.COMPLETED,
        }),
        'requester-b',
      ),
    ).toThrow(ConflictException);
  });

  it('accepts only pending proposals against available listings', () => {
    expect(() =>
      rules.assertProposalCanBeAccepted(
        listing(),
        ProposalStatus.PENDING,
        listing({
          id: 'listing-offered',
          ownerId: 'requester-b',
        }),
      ),
    ).not.toThrow();

    expect(() =>
      rules.assertProposalCanBeAccepted(
        listing(),
        ProposalStatus.REJECTED,
      ),
    ).toThrow(ConflictException);

    expect(() =>
      rules.assertProposalCanBeAccepted(
        listing({
          availabilityStatus:
            ListingAvailabilityStatus.RESERVED,
        }),
        ProposalStatus.PENDING,
      ),
    ).toThrow(ConflictException);
  });

  it('allows only participants to confirm an in-progress transaction', () => {
    const transaction = {
      ownerId: 'owner-a',
      requesterId: 'requester-b',
      status: MarketplaceTransactionStatus.IN_PROGRESS,
    };

    expect(() =>
      rules.assertCanConfirmTransaction(
        transaction,
        'owner-a',
      ),
    ).not.toThrow();

    expect(() =>
      rules.assertCanConfirmTransaction(
        transaction,
        'requester-b',
      ),
    ).not.toThrow();

    expect(() =>
      rules.assertCanConfirmTransaction(
        transaction,
        'intruder',
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      rules.assertCanConfirmTransaction(
        {
          ...transaction,
          status:
            MarketplaceTransactionStatus.COMPLETED,
        },
        'owner-a',
      ),
    ).toThrow(ConflictException);
  });
});
