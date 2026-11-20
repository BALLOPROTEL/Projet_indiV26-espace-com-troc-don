import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus } from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import type { ObjectStorageService } from '../storage/object-storage.service';
import { ProductImagesService } from './product-images.service';

function pngFile() {
  const buffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x00,
  ]);

  return {
    buffer,
    mimetype: 'image/png',
    originalname: 'product.png',
    size: buffer.length,
  };
}

describe('ProductImagesService', () => {
  const product = {
    findUnique: jest.fn(),
  };
  const productImage = {
    findFirst: jest.fn(),
    deleteMany: jest.fn(),
  };
  const transaction = {
    product: {
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    product,
    productImage,
    $transaction: jest.fn(
      async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
    ),
  } as unknown as PrismaService;

  const storage = {
    assertReady: jest.fn(),
    putObject: jest.fn(),
    deleteObjects: jest.fn(),
    readObject: jest.fn(),
  } as unknown as ObjectStorageService;

  const service = new ProductImagesService(prisma, storage);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an empty product image batch', async () => {
    await expect(
      service.replaceImages('product-1', []),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(product.findUnique).not.toHaveBeenCalled();
  });

  it('stores replacement images under the product prefix and cleans old objects', async () => {
    product.findUnique.mockResolvedValue({
      id: 'product-1',
      status: ProductStatus.DRAFT,
      updatedAt: new Date('2026-11-20T20:00:00.000Z'),
      images: [
        {
          id: 'old',
          objectKey: 'products/product-1/old.png',
        },
      ],
    });
    transaction.product.updateMany.mockResolvedValue({ count: 1 });
    transaction.product.update.mockImplementation(
      async ({ data }: { data: { images: { create: unknown[] } } }) => ({
        images: data.images.create.map((item, position) => ({
          id: `new-${position}`,
          productId: 'product-1',
          ...(item as Record<string, unknown>),
          createdAt: new Date(),
        })),
      }),
    );

    const images = await service.replaceImages(
      'product-1',
      [pngFile()],
    );

    expect(storage.putObject).toHaveBeenCalledWith(
      expect.stringMatching(/^products\/product-1\/.+\.png$/),
      expect.any(Buffer),
      'image/png',
    );
    expect(storage.deleteObjects).toHaveBeenCalledWith([
      'products/product-1/old.png',
    ]);
    expect(images).toHaveLength(1);
  });

  it('prevents removing every image from a published product', async () => {
    product.findUnique.mockResolvedValue({
      id: 'product-1',
      status: ProductStatus.PUBLISHED,
      updatedAt: new Date(),
      images: [{ id: 'image-1', objectKey: 'products/product-1/a.png' }],
    });

    await expect(
      service.deleteDraftImages('product-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(productImage.deleteMany).not.toHaveBeenCalled();
  });

  it('does not read an image publicly unless its product is published', async () => {
    productImage.findFirst.mockResolvedValue(null);

    await expect(
      service.readPublicImage('product-1', 'image-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.readObject).not.toHaveBeenCalled();
  });
});
