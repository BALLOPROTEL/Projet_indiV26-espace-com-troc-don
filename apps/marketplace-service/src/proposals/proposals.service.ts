import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProposalStatus, ProposalType } from '../../generated/prisma';
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

  async accept(id: string, ownerId: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    const target = await this.catalog.getListing(proposal.targetListingId);

    if (target.ownerId !== ownerId) {
      throw new ForbiddenException(
        'Only the target listing owner can accept this proposal',
      );
    }

    const offered = proposal.offeredListingId
      ? await this.catalog.getListing(proposal.offeredListingId)
      : undefined;

    this.rules.assertProposalCanBeAccepted(
      target,
      proposal.status,
      offered,
    );

    let targetReserved = false;
    let offeredReserved = false;

    try {
      await this.catalog.reserveListing(target.id);
      targetReserved = true;

      if (offered) {
        await this.catalog.reserveListing(offered.id);
        offeredReserved = true;
      }

      return await this.prisma.$transaction(async (tx) => {
        const accepted = await tx.proposal.updateMany({
          where: {
            id: proposal.id,
            status: ProposalStatus.PENDING,
          },
          data: {
            status: ProposalStatus.ACCEPTED,
            resolvedAt: new Date(),
          },
        });

        if (accepted.count !== 1) {
          throw new ConflictException(
            'Only a pending proposal can be accepted',
          );
        }

        await tx.proposal.updateMany({
          where: {
            id: { not: proposal.id },
            targetListingId: proposal.targetListingId,
            status: ProposalStatus.PENDING,
          },
          data: {
            status: ProposalStatus.REJECTED,
            resolvedAt: new Date(),
          },
        });

        return tx.marketplaceTransaction.create({
          data: {
            proposalId: proposal.id,
            targetListingId: proposal.targetListingId,
            offeredListingId: proposal.offeredListingId,
            ownerId,
            requesterId: proposal.requesterId,
          },
        });
      });
    } catch (error) {
      if (offeredReserved && offered) {
        await this.safeRelease(offered.id);
      }

      if (targetReserved) {
        await this.safeRelease(target.id);
      }

      throw error;
    }
  }

  private async safeRelease(id: string): Promise<void> {
    try {
      await this.catalog.releaseListing(id);
    } catch {
      // Best-effort compensation. A later reconciliation job can retry it.
    }
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
