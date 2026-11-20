import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus } from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 'product-1',
    slug: 'product-one',
    name: 'Product One',
    description: 'A product used only by the unit test suite.',
    category: 'Tests',
    currency: 'EUR',
    status: ProductStatus.DRAFT,
    createdAt: new Date('2026-11-20T20:00:00.000Z'),
    updatedAt: new Date('2026-11-20T20:00:00.000Z'),
    variants: [
      {
        id: 'variant-1',
        productId: 'product-1',
        sku: 'TEST-ONE',
        label: 'Standard',
        priceCents: 2500,
        stock: 4,
        active: true,
        createdAt: new Date('2026-11-20T20:00:00.000Z'),
        updatedAt: new Date('2026-11-20T20:00:00.000Z'),
      },
    ],
    images: [
      {
        id: 'image-1',
        productId: 'product-1',
        objectKey: 'products/product-1/image.png',
        mimeType: 'image/png',
        sizeBytes: 128,
        position: 0,
        createdAt: new Date('2026-11-20T20:00:00.000Z'),
      },
    ],
    ...overrides,
  };
}

describe('ProductsService', () => {
  const prisma = {
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    productVariant: {
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const service = new ProductsService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('queries only published products with an active variant', async () => {
    (prisma.product.findMany as jest.Mock).mockResolvedValue([
      product({ status: ProductStatus.PUBLISHED }),
    ]);

    const result = await service.findPublic({
      q: 'product',
      category: 'Tests',
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ProductStatus.PUBLISHED,
          variants: { some: { active: true } },
        }),
      }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        slug: 'product-one',
        fromPriceCents: 2500,
        availableStock: 4,
        images: [
          expect.objectContaining({
            contentUrl: '/api/products/product-1/images/image-1/content',
          }),
        ],
      }),
    );
    expect('status' in result[0]).toBe(false);
  });

  it('never resolves a draft product through the public detail contract', async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.findPublicBySlug('draft-product'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates commercial products as DRAFT only', async () => {
    (prisma.product.create as jest.Mock).mockResolvedValue(product());

    await service.create({
      slug: 'product-one',
      name: 'Product One',
      description: 'A product created by an administrator for testing.',
      category: 'Tests',
      variants: [
        {
          sku: 'TEST-ONE',
          label: 'Standard',
          priceCents: 2500,
          stock: 4,
        },
      ],
    });

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ProductStatus.DRAFT,
          currency: 'EUR',
        }),
      }),
    );
  });

  it('rejects duplicate SKUs before touching the database', async () => {
    await expect(
      service.create({
        slug: 'duplicate-skus',
        name: 'Duplicate SKU test',
        description: 'A product that intentionally repeats its SKU.',
        category: 'Tests',
        variants: [
          {
            sku: 'DUP-ONE',
            label: 'A',
            priceCents: 1000,
            stock: 1,
          },
          {
            sku: 'DUP-ONE',
            label: 'B',
            priceCents: 1200,
            stock: 2,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('refuses to publish a product with no active variants', async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValue(
      product({
        variants: [
          {
            ...product().variants[0],
            active: false,
          },
        ],
      }),
    );

    await expect(
      service.publish('product-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('refuses to publish a product without a real image', async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValue(
      product({ images: [] }),
    );

    await expect(
      service.publish('product-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('does not allow the last active variant of a published product to be disabled', async () => {
    (prisma.product.findUnique as jest.Mock).mockResolvedValue(
      product({ status: ProductStatus.PUBLISHED }),
    );

    await expect(
      service.updateVariant('product-1', 'variant-1', {
        active: false,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.productVariant.update).not.toHaveBeenCalled();
  });

  it('archives a product through an explicit server transition', async () => {
    (prisma.product.findUnique as jest.Mock)
      .mockResolvedValueOnce(product({ status: ProductStatus.PUBLISHED }))
      .mockResolvedValueOnce(product({ status: ProductStatus.ARCHIVED }));
    (prisma.product.update as jest.Mock).mockResolvedValue(
      product({ status: ProductStatus.ARCHIVED }),
    );

    const result = await service.archive('product-1');

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: { status: ProductStatus.ARCHIVED },
    });
    expect(result.status).toBe(ProductStatus.ARCHIVED);
  });
});
