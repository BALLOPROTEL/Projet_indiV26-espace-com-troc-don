import { ConfigService } from '@nestjs/config';
import {
  ListingOperationType,
  ListingStatus,
} from '@prisma/client';
import { ListingImagesService } from '../src/listings/listing-images.service';
import { UploadedImageFile } from '../src/listings/image-file.validator';
import { PrismaService } from '../src/prisma/prisma.service';
import { ObjectStorageService } from '../src/storage/object-storage.service';

describe('LOT 9B-B object storage integration', () => {
  const prisma = new PrismaService();
  const config = new ConfigService({
    S3_ENDPOINT:
      process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9000',
    S3_REGION: process.env.S3_REGION ?? 'us-east-1',
    S3_BUCKET: process.env.S3_BUCKET ?? 'listing-images',
    S3_ACCESS_KEY:
      process.env.S3_ACCESS_KEY ?? 'marketplace-api',
    S3_SECRET_KEY:
      process.env.S3_SECRET_KEY ??
      'marketplace_storage_local_change_me_2026',
    S3_FORCE_PATH_STYLE:
      process.env.S3_FORCE_PATH_STYLE ?? 'true',
  });
  const storage = new ObjectStorageService(config);
  const service = new ListingImagesService(
    prisma,
    storage,
  );
  const ownerPrefix = 'lot9b-b-storage-';

  const png = (index: number): UploadedImageFile => {
    const signature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const payload = Buffer.from(
      `integration-image-${index}`,
      'utf8',
    );
    const buffer = Buffer.concat([signature, payload]);

    return {
      buffer,
      mimetype: 'image/png',
      originalname: `image-${index}.png`,
      size: buffer.length,
    };
  };

  async function cleanup(): Promise<void> {
    const images = await prisma.listingImage.findMany({
      where: {
        listing: {
          ownerId: {
            startsWith: ownerPrefix,
          },
        },
      },
      select: {
        objectKey: true,
      },
    });

    if (images.length > 0) {
      await storage.deleteObjects(
        images.map((image) => image.objectKey),
      );
    }

    await prisma.listing.deleteMany({
      where: {
        ownerId: {
          startsWith: ownerPrefix,
        },
      },
    });
  }

  beforeAll(async () => {
    await storage.assertReady();
  });

  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('stores 5 private objects, persists metadata and reads them after approval', async () => {
    const ownerId = `${ownerPrefix}owner`;

    const listing = await prisma.listing.create({
      data: {
        ownerId,
        title: 'Appareil photo argentique',
        description:
          'Appareil photo argentique avec objectif et housse.',
        operationType: ListingOperationType.TRADE,
      },
    });

    const files = [0, 1, 2, 3, 4].map(png);

    const uploaded = await service.replaceOwnedImages(
      listing.id,
      ownerId,
      files,
    );

    expect(uploaded).toHaveLength(5);
    expect(uploaded.map((image) => image.position)).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(
      uploaded.every(
        (image) =>
          image.contentUrl.includes(listing.id) &&
          !('objectKey' in image),
      ),
    ).toBe(true);

    const persisted = await prisma.listing.findUnique({
      where: {
        id: listing.id,
      },
      include: {
        images: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    expect(persisted?.status).toBe(ListingStatus.PENDING);
    expect(persisted?.images).toHaveLength(5);
    expect(
      persisted?.images.every((image) =>
        image.objectKey.startsWith(
          `listings/${listing.id}/`,
        ),
      ),
    ).toBe(true);

    await prisma.listing.update({
      where: {
        id: listing.id,
      },
      data: {
        status: ListingStatus.APPROVED,
      },
    });

    const publicImages = await service.findPublicImages(
      listing.id,
    );

    expect(publicImages).toHaveLength(5);

    const first = await service.readPublicImage(
      listing.id,
      publicImages[0]!.id,
    );

    expect(first.contentType).toBe('image/png');
    expect(first.body).toEqual(files[0]!.buffer);
  });
});
