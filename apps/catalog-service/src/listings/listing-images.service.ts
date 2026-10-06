import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingAvailabilityStatus,
  ListingImage,
  ListingStatus,
} from '../../generated/prisma';
import { randomUUID } from 'node:crypto';
import {
  MAX_LISTING_IMAGES,
  MIN_LISTING_IMAGES,
} from '../marketplace/marketplace-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import {
  UploadedImageFile,
  validateUploadedImage,
} from './image-file.validator';

export type PublicListingImage = {
  id: string;
  position: number;
  mimeType: string;
  sizeBytes: number;
  contentUrl: string;
};

export type ListingImageContent = {
  body: Buffer;
  contentType: string;
  contentLength?: number;
};

@Injectable()
export class ListingImagesService {
  private readonly logger = new Logger(ListingImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  async replaceOwnedImages(
    listingId: string,
    ownerId: string,
    files: UploadedImageFile[],
  ): Promise<PublicListingImage[]> {
    this.assertBatchSize(files.length);

    const listing = await this.requireEditableListing(
      listingId,
      ownerId,
    );

    const validated = files.map((file) => ({
      file,
      detected: validateUploadedImage(file),
    }));

    await this.storage.assertReady();

    const uploaded: Array<{
      objectKey: string;
      mimeType: string;
      sizeBytes: number;
      position: number;
    }> = [];

    try {
      for (const [position, entry] of validated.entries()) {
        const objectKey =
          `listings/${listingId}/${randomUUID()}.${entry.detected.extension}`;

        uploaded.push({
          objectKey,
          mimeType: entry.detected.mimeType,
          sizeBytes: entry.file.buffer.length,
          position,
        });

        await this.storage.putObject(
          objectKey,
          entry.file.buffer,
          entry.detected.mimeType,
        );
      }
    } catch (error) {
      await this.bestEffortDelete(
        uploaded.map((image) => image.objectKey),
        'rollback after upload failure',
      );
      throw error;
    }

    let images: ListingImage[];

    try {
      const updated = await this.prisma.$transaction(
        async (transaction) => {
          const claim = await transaction.listing.updateMany({
            where: {
              id: listingId,
              ownerId,
              updatedAt: listing.updatedAt,
            },
            data: {
              status: ListingStatus.PENDING,
              moderationReason: null,
              updatedAt: new Date(
                listing.updatedAt.getTime() + 1,
              ),
            },
          });

          if (claim.count !== 1) {
            throw new ConflictException(
              'Listing changed while images were uploading; retry',
            );
          }

          return transaction.listing.update({
            where: {
              id: listingId,
            },
            data: {
              status: ListingStatus.PENDING,
              moderationReason: null,
              images: {
                deleteMany: {},
                create: uploaded,
              },
            },
            include: {
              images: {
                orderBy: {
                  position: 'asc',
                },
              },
            },
          });
        },
      );

      images = updated.images;
    } catch (error) {
      await this.bestEffortDelete(
        uploaded.map((image) => image.objectKey),
        'rollback after database failure',
      );
      throw error;
    }

    await this.bestEffortDelete(
      listing.images.map((image) => image.objectKey),
      'cleanup of replaced images',
    );

    return images.map((image) =>
      this.toPublicImage(listingId, image),
    );
  }

  async deleteOwnedImages(
    listingId: string,
    ownerId: string,
  ): Promise<{ deleted: number }> {
    const listing = await this.requireEditableListing(
      listingId,
      ownerId,
    );

    if (listing.images.length === 0) {
      return {
        deleted: 0,
      };
    }

    await this.prisma.$transaction(async (transaction) => {
      const claim = await transaction.listing.updateMany({
        where: {
          id: listingId,
          ownerId,
          status: {
            not: ListingStatus.APPROVED,
          },
          availabilityStatus:
            ListingAvailabilityStatus.AVAILABLE,
          updatedAt: listing.updatedAt,
        },
        data: {
          status: ListingStatus.PENDING,
          moderationReason: null,
          updatedAt: new Date(
            listing.updatedAt.getTime() + 1,
          ),
        },
      });

      if (claim.count !== 1) {
        throw new ConflictException(
          'Listing changed while images were being deleted; retry',
        );
      }

      await transaction.listingImage.deleteMany({
        where: {
          listingId,
        },
      });
    });

    await this.bestEffortDelete(
      listing.images.map((image) => image.objectKey),
      'cleanup after image metadata deletion',
    );

    return {
      deleted: listing.images.length,
    };
  }

  async findPublicImages(
    listingId: string,
  ): Promise<PublicListingImage[]> {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id: listingId,
        status: ListingStatus.APPROVED,
      },
      include: {
        images: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return listing.images.map((image) =>
      this.toPublicImage(listingId, image),
    );
  }

  async readAuthorizedImage(
    listingId: string,
    imageId: string,
    requesterId: string,
    canModerate: boolean,
  ): Promise<ListingImageContent> {
    const image = await this.prisma.listingImage.findFirst({
      where: {
        id: imageId,
        listingId,
      },
      include: {
        listing: true,
      },
    });

    if (!image) {
      throw new NotFoundException('Listing image not found');
    }

    if (
      image.listing.ownerId !== requesterId &&
      !canModerate
    ) {
      throw new ForbiddenException(
        'Only the listing owner or a moderator may read this image',
      );
    }

    const object = await this.storage.readObject(
      image.objectKey,
    );

    return {
      body: object.body,
      contentType: image.mimeType,
      contentLength:
        object.contentLength ?? image.sizeBytes,
    };
  }

  async readPublicImage(
    listingId: string,
    imageId: string,
  ): Promise<ListingImageContent> {
    const image = await this.prisma.listingImage.findFirst({
      where: {
        id: imageId,
        listingId,
        listing: {
          status: ListingStatus.APPROVED,
        },
      },
    });

    if (!image) {
      throw new NotFoundException('Listing image not found');
    }

    const object = await this.storage.readObject(
      image.objectKey,
    );

    return {
      body: object.body,
      contentType: image.mimeType,
      contentLength:
        object.contentLength ?? image.sizeBytes,
    };
  }

  private assertBatchSize(count: number): void {
    if (
      count < MIN_LISTING_IMAGES ||
      count > MAX_LISTING_IMAGES
    ) {
      throw new BadRequestException(
        `Upload between ${MIN_LISTING_IMAGES} and ${MAX_LISTING_IMAGES} images`,
      );
    }
  }

  private async requireEditableListing(
    listingId: string,
    ownerId: string,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: {
        id: listingId,
      },
      include: {
        images: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.ownerId !== ownerId) {
      throw new ForbiddenException(
        'Only the listing owner may manage its images',
      );
    }

    if (listing.status === ListingStatus.APPROVED) {
      throw new ConflictException(
        'Images of an approved listing cannot be changed',
      );
    }

    if (
      listing.availabilityStatus !==
      ListingAvailabilityStatus.AVAILABLE
    ) {
      throw new ConflictException(
        'Images cannot be changed once the listing is reserved or completed',
      );
    }

    return listing;
  }

  private toPublicImage(
    listingId: string,
    image: ListingImage,
  ): PublicListingImage {
    return {
      id: image.id,
      position: image.position,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      contentUrl:
        `/api/listings/${listingId}/images/${image.id}/content`,
    };
  }

  private async bestEffortDelete(
    objectKeys: string[],
    reason: string,
  ): Promise<void> {
    if (objectKeys.length === 0) {
      return;
    }

    try {
      await this.storage.deleteObjects(objectKeys);
    } catch {
      this.logger.warn(
        `Object storage cleanup failed: ${reason}`,
      );
    }
  }
}
