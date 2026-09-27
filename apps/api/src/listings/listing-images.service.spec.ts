import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingAvailabilityStatus,
  ListingOperationType,
  ListingStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { UploadedImageFile } from './image-file.validator';
import { ListingImagesService } from './listing-images.service';

describe('ListingImagesService', () => {
  const listingApi = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const listingImageApi = {
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
  };
  const prisma = {
    listing: listingApi,
    listingImage: listingImageApi,
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const storage = {
    assertReady: jest.fn(),
    putObject: jest.fn(),
    readObject: jest.fn(),
    deleteObjects: jest.fn(),
  } as unknown as ObjectStorageService;

  const service = new ListingImagesService(
    prisma,
    storage,
  );

  const jpeg = (index: number): UploadedImageFile => {
    const buffer = Buffer.from([
      0xff,
      0xd8,
      0xff,
      index,
      0x00,
    ]);

    return {
      buffer,
      mimetype: 'image/jpeg',
      originalname: `image-${index}.jpg`,
      size: buffer.length,
    };
  };

  const listing = (overrides: Record<string, unknown> = {}) => ({
    id: 'listing-1',
    ownerId: 'owner-1',
    title: 'Objet',
    description: 'Description',
    operationType: ListingOperationType.TRADE,
    status: ListingStatus.PENDING,
    availabilityStatus:
      ListingAvailabilityStatus.AVAILABLE,
    moderationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    images: [],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: (transaction: PrismaService) => unknown) =>
        callback(prisma),
    );
    listingApi.updateMany.mockResolvedValue({
      count: 1,
    });
    (storage.assertReady as jest.Mock).mockResolvedValue(
      undefined,
    );
    (storage.putObject as jest.Mock).mockResolvedValue(
      undefined,
    );
    (storage.deleteObjects as jest.Mock).mockResolvedValue(
      undefined,
    );
  });

  it('uploads 5 validated images and persists only generated object keys', async () => {
    listingApi.findUnique.mockResolvedValue(listing());
    listingApi.update.mockImplementation(
      async (input: {
        data: {
          images: {
            create: Array<{
              objectKey: string;
              mimeType: string;
              sizeBytes: number;
              position: number;
            }>;
          };
        };
      }) => ({
        ...listing(),
        images: input.data.images.create.map(
          (image, index) => ({
            id: `image-${index}`,
            listingId: 'listing-1',
            createdAt: new Date(),
            ...image,
          }),
        ),
      }),
    );

    const result = await service.replaceOwnedImages(
      'listing-1',
      'owner-1',
      [0, 1, 2, 3, 4].map(jpeg),
    );

    expect(storage.assertReady).toHaveBeenCalledTimes(1);
    expect(storage.putObject).toHaveBeenCalledTimes(5);
    expect(listingApi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'listing-1',
        },
        data: expect.objectContaining({
          status: ListingStatus.PENDING,
          moderationReason: null,
        }),
      }),
    );
    expect(result).toHaveLength(5);
    expect(result[0]?.contentUrl).toContain(
      '/api/listings/listing-1/images/image-0/content',
    );
    expect(result[0]).not.toHaveProperty('objectKey');

    for (const call of (
      storage.putObject as jest.Mock
    ).mock.calls) {
      expect(call[0]).toMatch(
        /^listings\/listing-1\/[0-9a-f-]+\.jpg$/,
      );
    }
  });

  it('rejects batches outside the 5 to 8 image range before storage access', async () => {
    await expect(
      service.replaceOwnedImages(
        'listing-1',
        'owner-1',
        [0, 1, 2, 3].map(jpeg),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(listingApi.findUnique).not.toHaveBeenCalled();
    expect(storage.assertReady).not.toHaveBeenCalled();
  });

  it('rejects another owner and immutable listings', async () => {
    listingApi.findUnique.mockResolvedValue(listing());

    await expect(
      service.replaceOwnedImages(
        'listing-1',
        'intruder',
        [0, 1, 2, 3, 4].map(jpeg),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    listingApi.findUnique.mockResolvedValue(
      listing({
        status: ListingStatus.APPROVED,
      }),
    );

    await expect(
      service.replaceOwnedImages(
        'listing-1',
        'owner-1',
        [0, 1, 2, 3, 4].map(jpeg),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    listingApi.findUnique.mockResolvedValue(
      listing({
        availabilityStatus:
          ListingAvailabilityStatus.RESERVED,
      }),
    );

    await expect(
      service.replaceOwnedImages(
        'listing-1',
        'owner-1',
        [0, 1, 2, 3, 4].map(jpeg),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rolls back newly uploaded objects when a later upload fails', async () => {
    listingApi.findUnique.mockResolvedValue(listing());

    (storage.putObject as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('S3 down'));

    await expect(
      service.replaceOwnedImages(
        'listing-1',
        'owner-1',
        [0, 1, 2, 3, 4].map(jpeg),
      ),
    ).rejects.toThrow('S3 down');

    expect(storage.deleteObjects).toHaveBeenCalledTimes(1);
    expect(
      (storage.deleteObjects as jest.Mock).mock.calls[0][0],
    ).toHaveLength(3);
    expect(listingApi.update).not.toHaveBeenCalled();
  });

  it('rejects a stale concurrent image replacement', async () => {
    listingApi.findUnique.mockResolvedValue(listing());
    listingApi.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.replaceOwnedImages(
        'listing-1',
        'owner-1',
        [0, 1, 2, 3, 4].map(jpeg),
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(listingApi.update).not.toHaveBeenCalled();
    expect(storage.deleteObjects).toHaveBeenCalledTimes(1);
    expect(
      (storage.deleteObjects as jest.Mock).mock.calls[0][0],
    ).toHaveLength(5);
  });

  it('rolls back all new objects when database persistence fails', async () => {
    listingApi.findUnique.mockResolvedValue(listing());
    listingApi.update.mockRejectedValue(
      new Error('database down'),
    );

    await expect(
      service.replaceOwnedImages(
        'listing-1',
        'owner-1',
        [0, 1, 2, 3, 4].map(jpeg),
      ),
    ).rejects.toThrow('database down');

    expect(storage.putObject).toHaveBeenCalledTimes(5);
    expect(storage.deleteObjects).toHaveBeenCalledTimes(1);
    expect(
      (storage.deleteObjects as jest.Mock).mock.calls[0][0],
    ).toHaveLength(5);
  });

  it('cleans old objects after a successful replacement', async () => {
    listingApi.findUnique.mockResolvedValue(
      listing({
        images: [
          {
            id: 'old-1',
            listingId: 'listing-1',
            objectKey: 'listings/listing-1/old.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 10,
            position: 0,
            createdAt: new Date(),
          },
        ],
      }),
    );
    listingApi.update.mockImplementation(
      async (input: {
        data: {
          images: {
            create: Array<Record<string, unknown>>;
          };
        };
      }) => ({
        ...listing(),
        images: input.data.images.create.map(
          (image, index) => ({
            id: `new-${index}`,
            listingId: 'listing-1',
            createdAt: new Date(),
            ...image,
          }),
        ),
      }),
    );

    await service.replaceOwnedImages(
      'listing-1',
      'owner-1',
      [0, 1, 2, 3, 4].map(jpeg),
    );

    expect(storage.deleteObjects).toHaveBeenCalledWith([
      'listings/listing-1/old.jpg',
    ]);
  });

  it('deletes image metadata before best-effort object cleanup', async () => {
    listingApi.findUnique.mockResolvedValue(
      listing({
        images: [
          {
            id: 'image-1',
            objectKey: 'listings/listing-1/image.jpg',
          },
        ],
      }),
    );
    listingImageApi.deleteMany.mockResolvedValue({
      count: 1,
    });

    await expect(
      service.deleteOwnedImages('listing-1', 'owner-1'),
    ).resolves.toEqual({
      deleted: 1,
    });

    expect(listingImageApi.deleteMany).toHaveBeenCalledWith({
      where: {
        listingId: 'listing-1',
      },
    });
    expect(storage.deleteObjects).toHaveBeenCalledWith([
      'listings/listing-1/image.jpg',
    ]);
  });

  it('exposes public image metadata without object keys', async () => {
    listingApi.findFirst.mockResolvedValue({
      ...listing({
        status: ListingStatus.APPROVED,
      }),
      images: [
        {
          id: 'image-public',
          listingId: 'listing-1',
          objectKey: 'private/object-key.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 5,
          position: 0,
          createdAt: new Date(),
        },
      ],
    });

    const images = await service.findPublicImages(
      'listing-1',
    );

    expect(images).toEqual([
      {
        id: 'image-public',
        position: 0,
        mimeType: 'image/jpeg',
        sizeBytes: 5,
        contentUrl:
          '/api/listings/listing-1/images/image-public/content',
      },
    ]);
    expect(images[0]).not.toHaveProperty('objectKey');
  });

  it('reads only an image attached to an approved listing', async () => {
    listingImageApi.findFirst.mockResolvedValue({
      id: 'image-public',
      listingId: 'listing-1',
      objectKey: 'listings/listing-1/image.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 5,
      position: 0,
      createdAt: new Date(),
    });
    (storage.readObject as jest.Mock).mockResolvedValue({
      body: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      contentType: 'image/jpeg',
      contentLength: 4,
    });

    const result = await service.readPublicImage(
      'listing-1',
      'image-public',
    );

    expect(result.contentType).toBe('image/jpeg');
    expect(storage.readObject).toHaveBeenCalledWith(
      'listings/listing-1/image.jpg',
    );

    listingImageApi.findFirst.mockResolvedValue(null);

    await expect(
      service.readPublicImage(
        'listing-1',
        'missing-image',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
