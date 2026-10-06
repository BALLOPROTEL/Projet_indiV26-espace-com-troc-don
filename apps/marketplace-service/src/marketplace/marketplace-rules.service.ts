import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
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

type TransactionIdentity = {
  ownerId: string;
  requesterId: string;
  status: MarketplaceTransactionStatus;
};

@Injectable()
export class MarketplaceRulesService {
  assertCanRequestDonation(
    target: CatalogListingSnapshot,
    requesterId: string,
  ): void {
    this.assertTargetCanReceiveProposal(target, requesterId);

    if (target.operationType !== ListingOperationType.DONATION) {
      throw new BadRequestException(
        'Donation requests are only allowed on donation listings',
      );
    }
  }

  assertCanOfferTrade(
    target: CatalogListingSnapshot,
    offered: CatalogListingSnapshot,
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

    this.assertApprovedAndAvailable(offered, 'The offered listing');
  }

  assertProposalCanBeAccepted(
    target: CatalogListingSnapshot,
    proposalStatus: ProposalStatus,
    offered?: CatalogListingSnapshot,
  ): void {
    this.assertApprovedAndAvailable(target, 'The target listing');

    if (proposalStatus !== ProposalStatus.PENDING) {
      throw new ConflictException(
        'Only a pending proposal can be accepted',
      );
    }

    if (offered) {
      this.assertApprovedAndAvailable(offered, 'The offered listing');
    }
  }

  assertCanConfirmTransaction(
    transaction: TransactionIdentity,
    actorId: string,
  ): void {
    if (transaction.status !== MarketplaceTransactionStatus.IN_PROGRESS) {
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

  private assertTargetCanReceiveProposal(
    target: CatalogListingSnapshot,
    requesterId: string,
  ): void {
    if (target.ownerId === requesterId) {
      throw new ForbiddenException(
        'A user cannot make a proposal on their own listing',
      );
    }

    this.assertApprovedAndAvailable(target, 'The target listing');
  }

  private assertApprovedAndAvailable(
    listing: CatalogListingSnapshot,
    label: string,
  ): void {
    if (listing.status !== ListingStatus.APPROVED) {
      throw new ConflictException(`${label} must be approved`);
    }

    if (listing.availabilityStatus !== ListingAvailabilityStatus.AVAILABLE) {
      throw new ConflictException(`${label} is not available`);
    }
  }
}
