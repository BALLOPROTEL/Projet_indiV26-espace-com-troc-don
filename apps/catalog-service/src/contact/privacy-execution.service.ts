import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  ContactStatus,
  ContactSubject,
  PrivacyAction,
  PrivacyExecutionStatus,
  Prisma,
} from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';

type PrivacyTarget = {
  replacementId?: string;
};

@Injectable()
export class PrivacyExecutionService {
  private readonly token: string;
  private readonly marketplaceUrl: string;
  private readonly notificationUrl: string;
  private readonly commerceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    private readonly storage: ObjectStorageService,
  ) {
    this.token = this.requireConfig(config, 'INTERNAL_SERVICE_TOKEN');
    this.marketplaceUrl = this.requireConfig(
      config,
      'MARKETPLACE_INTERNAL_URL',
    ).replace(/\/$/, '');
    this.notificationUrl = this.requireConfig(
      config,
      'NOTIFICATION_INTERNAL_URL',
    ).replace(/\/$/, '');
    this.commerceUrl = this.requireConfig(
      config,
      'COMMERCE_INTERNAL_URL',
    ).replace(/\/$/, '');
  }

  async execute(contactMessageId: string, reviewerId: string) {
    const request = await this.prisma.contactMessage.findUnique({
      where: { id: contactMessageId },
    });

    if (!request) {
      throw new NotFoundException('Privacy request not found');
    }

    if (
      request.subject !== ContactSubject.PRIVACY ||
      !request.userId ||
      !request.privacyAction ||
      ![PrivacyAction.ANONYMIZE, PrivacyAction.ERASE].includes(
        request.privacyAction,
      )
    ) {
      throw new ConflictException(
        'This request is not eligible for anonymization',
      );
    }

    let execution =
      await this.prisma.privacyExecution.findUnique({
        where: { contactMessageId },
      });

    if (
      execution?.status === PrivacyExecutionStatus.COMPLETED
    ) {
      return {
        execution,
        catalog: {
          listingsAnonymized: 0,
          favoritesRemoved: 0,
          reportsAnonymized: 0,
          contactMessagesRedacted: 0,
        },
        identityDeletionRequired:
          request.privacyAction === PrivacyAction.ERASE,
        alreadyCompleted: true,
      };
    }

    if (!execution) {
      execution = await this.prisma.privacyExecution.create({
        data: {
          contactMessageId,
          originalUserId: request.userId,
          catalogReplacementId: 'anon-catalog-' + randomUUID(),
          marketplaceReplacementId:
            'anon-marketplace-' + randomUUID(),
          commerceReplacementId:
            'anon-commerce-' + randomUUID(),
          reviewerId,
        },
      });
    }

    const originalUserId = execution.originalUserId;
    if (!originalUserId) {
      throw new ConflictException(
        'Privacy execution no longer contains a source identity',
      );
    }

    await this.prisma.privacyExecution.update({
      where: { id: execution.id },
      data: {
        status: PrivacyExecutionStatus.IN_PROGRESS,
        reviewerId,
        lastError: null,
      },
    });
    await this.prisma.contactMessage.update({
      where: { id: contactMessageId },
      data: { status: ContactStatus.IN_PROGRESS },
    });

    try {
      await this.callRemote(
        this.marketplaceUrl,
        originalUserId,
        {
          replacementId: execution.marketplaceReplacementId,
        },
      );
      await this.callRemote(
        this.notificationUrl,
        originalUserId,
        {},
      );
      await this.callRemote(
        this.commerceUrl,
        originalUserId,
        {
          replacementId: execution.commerceReplacementId,
        },
      );

      const result = await this.anonymizeCatalog(
        originalUserId,
        execution.catalogReplacementId,
        execution.id,
        reviewerId,
      );

      return {
        ...result,
        identityDeletionRequired:
          request.privacyAction === PrivacyAction.ERASE,
      };
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message.slice(0, 1000)
          : 'Unknown privacy execution error';

      await this.prisma.privacyExecution.update({
        where: { id: execution.id },
        data: {
          status: PrivacyExecutionStatus.FAILED,
          lastError: message,
        },
      });

      throw new BadGatewayException(
        'Anonymization is incomplete and can be retried safely',
      );
    }
  }

  private async anonymizeCatalog(
    originalUserId: string,
    replacementId: string,
    executionId: string,
    reviewerId: string,
  ) {
    const ownedListings = await this.prisma.listing.findMany({
      where: { ownerId: originalUserId },
      select: {
        id: true,
        images: {
          select: { objectKey: true },
        },
      },
    });
    const listingIds = ownedListings.map((listing) => listing.id);
    const objectKeys = ownedListings.flatMap((listing) =>
      listing.images.map((image) => image.objectKey),
    );

    // Object deletion is idempotent. Doing it before metadata cleanup means a
    // database failure can be retried while the same object keys are still known.
    await this.storage.deleteObjects(objectKeys);

    return this.prisma.$transaction(async (tx) => {
      if (listingIds.length > 0) {
        await tx.listingImage.deleteMany({
          where: { listingId: { in: listingIds } },
        });
        await tx.listingTradeWish.deleteMany({
          where: { listingId: { in: listingIds } },
        });
      }

      const listings = await tx.listing.updateMany({
        where: { ownerId: originalUserId },
        data: {
          ownerId: replacementId,
          title: 'Annonce retirée',
          description:
            'Contenu retiré après anonymisation du compte.',
          status: 'REJECTED',
          moderationReason:
            'Annonce retirée après anonymisation du compte.',
        },
      });
      const favorites = await tx.listingFavorite.deleteMany({
        where: {
          OR: [
            { userId: originalUserId },
            ...(listingIds.length > 0
              ? [{ listingId: { in: listingIds } }]
              : []),
          ],
        },
      });

      const enrichmentColumns = await tx.$queryRaw<
        Array<{ present: boolean }>
      >(
        Prisma.sql`SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'Listing' AND column_name = 'city'
        ) AS present`,
      );

      if (enrichmentColumns[0]?.present && listingIds.length > 0) {
        await tx.$executeRaw(
          Prisma.sql`UPDATE "Listing"
            SET "category" = NULL, "city" = NULL, "condition" = NULL
            WHERE "id" IN (${Prisma.join(listingIds)})`,
        );
      }

      const reportTable = await tx.$queryRaw<Array<{ present: boolean }>>(
        Prisma.sql`SELECT to_regclass('"ListingReport"') IS NOT NULL AS present`,
      );

      let reports = 0;
      if (reportTable[0]?.present) {
        reports += await tx.$executeRaw(
          Prisma.sql`UPDATE "ListingReport"
            SET "reporterId" = ${replacementId}
            WHERE "reporterId" = ${originalUserId}`,
        );
        reports += await tx.$executeRaw(
          Prisma.sql`UPDATE "ListingReport"
            SET "reviewerId" = ${replacementId}
            WHERE "reviewerId" = ${originalUserId}`,
        );
      }

      const contactMessages = await tx.contactMessage.updateMany({
        where: { userId: originalUserId },
        data: {
          userId: null,
          name: null,
          email: null,
          message:
            '[contenu retiré après anonymisation du compte]',
          status: ContactStatus.CLOSED,
        },
      });

      await tx.privacyExecution.updateMany({
        where: {
          reviewerId: originalUserId,
          id: { not: executionId },
        },
        data: {
          reviewerId: replacementId,
        },
      });

      const completed = await tx.privacyExecution.update({
        where: { id: executionId },
        data: {
          originalUserId: null,
          status: PrivacyExecutionStatus.COMPLETED,
          lastError: null,
          completedAt: new Date(),
          reviewerId:
            reviewerId === originalUserId
              ? replacementId
              : reviewerId,
        },
      });

      return {
        execution: completed,
        catalog: {
          listingsAnonymized: listings.count,
          favoritesRemoved: favorites.count,
          reportsAnonymized: reports,
          contactMessagesRedacted: contactMessages.count,
          listingImagesRemoved: objectKeys.length,
        },
      };
    });
  }

  private async callRemote(
    baseUrl: string,
    userId: string,
    target: PrivacyTarget,
  ) {
    const response = await fetch(
      baseUrl +
        '/internal/privacy/users/' +
        encodeURIComponent(userId) +
        '/anonymize',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-service-token': this.token,
        },
        body: target.replacementId
          ? JSON.stringify({
              replacementId: target.replacementId,
            })
          : JSON.stringify({}),
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      throw new Error(
        'Privacy service returned HTTP ' + response.status,
      );
    }

    return response.json();
  }

  private requireConfig(
    config: ConfigService,
    key: string,
  ): string {
    const value = config.get<string>(key)?.trim();
    if (!value) {
      throw new Error(key + ' must be configured');
    }
    return value;
  }
}
