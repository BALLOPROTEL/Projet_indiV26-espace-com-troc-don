import { BadRequestException, Injectable } from '@nestjs/common';
import { ProposalType } from '../../generated/prisma';
import { CatalogClientService } from '../catalog/catalog-client.service';
import { MarketplaceRulesService } from '../marketplace/marketplace-rules.service';
import { PrismaService } from '../prisma/prisma.service';

export type CreateProposalInput = {
  targetListingId?: string;
  type?: string;
  offeredListingId?: string;
  message?: string;
};

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogClientService,
    private readonly rules: MarketplaceRulesService,
  ) {}

  async create(requesterId: string, input: CreateProposalInput) {
    const targetListingId = this.requiredId(
      input.targetListingId,
      'targetListingId',
    );
    const type = this.proposalType(input.type);
    const message = this.message(input.message);
    const target = await this.catalog.getListing(targetListingId);

    let offeredListingId: string | null = null;

    if (type === ProposalType.DONATION_REQUEST) {
      if (input.offeredListingId?.trim()) {
        throw new BadRequestException(
          'A donation request cannot include an offered listing',
        );
      }

      this.rules.assertCanRequestDonation(target, requesterId);
    } else {
      offeredListingId = this.requiredId(
        input.offeredListingId,
        'offeredListingId',
      );
      const offered = await this.catalog.getListing(offeredListingId);
      this.rules.assertCanOfferTrade(target, offered, requesterId);
    }

    return this.prisma.proposal.create({
      data: {
        targetListingId,
        requesterId,
        type,
        offeredListingId,
        message,
      },
    });
  }

  findMine(requesterId: string) {
    return this.prisma.proposal.findMany({
      where: { requesterId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private requiredId(value: string | undefined, field: string): string {
    const normalized = value?.trim();

    if (!normalized) {
      throw new BadRequestException(`${field} is required`);
    }

    return normalized;
  }

  private proposalType(value: string | undefined): ProposalType {
    if (
      value !== ProposalType.DONATION_REQUEST &&
      value !== ProposalType.TRADE_OFFER
    ) {
      throw new BadRequestException('Invalid proposal type');
    }

    return value;
  }

  private message(value: string | undefined): string | null {
    if (value === undefined) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('message must be a string');
    }

    const normalized = value.trim();

    if (normalized.length > 1000) {
      throw new BadRequestException('message must be at most 1000 characters');
    }

    return normalized || null;
  }
}
