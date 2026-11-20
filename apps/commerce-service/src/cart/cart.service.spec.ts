import { ConflictException } from '@nestjs/common';
import type { CartItem } from '../../generated/prisma';
import type { CatalogClientService } from '../catalog/catalog-client.service';
import type { CatalogProductVariantSnapshot } from '../catalog/catalog-contract';
import type { PrismaService } from '../prisma/prisma.service';
import { CartService } from './cart.service';

function item(
  overrides: Partial<CartItem> = {},
): CartItem {
  return {
    id: 'item-1',
    cartId: 'cart-1',
    productId: 'product-1',
    variantId: 'variant-1',
    quantity: 2,
    createdAt: new Date('2026-11-20T20:00:00.000Z'),
    updatedAt: new Date('2026-11-20T20:00:00.000Z'),
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<CatalogProductVariantSnapshot> = {},
): CatalogProductVariantSnapshot {
  return {
    productId: 'product-1',
    slug: 'product-one',
    name: 'Product One',
    currency: 'EUR',
    status: 'PUBLISHED',
    variantId: 'variant-1',
    variantLabel: 'Standard',
    priceCents: 2500,
    stock: 10,
    active: true,
    primaryImageId: 'image-1',
    ...overrides,
  };
}

describe('CartService', () => {
  const prisma = {
    cart: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    cartItem: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const catalog = {
    getProductVariant: jest.fn(),
  } as unknown as CatalogClientService;

  const service = new CartService(prisma, catalog);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a stable empty cart without creating database state', async () => {
    (prisma.cart.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.get('user-1')).resolves.toEqual({
      items: [],
      currency: 'EUR',
      subtotalCents: 0,
      hasUnavailableItems: false,
    });
    expect(catalog.getProductVariant).not.toHaveBeenCalled();
  });

  it('recalculates current prices and excludes unavailable lines from subtotal', async () => {
    (prisma.cart.findUnique as jest.Mock).mockResolvedValue({
      id: 'cart-1',
      userId: 'user-1',
      items: [
        item(),
        item({
          id: 'item-2',
          productId: 'product-2',
          variantId: 'variant-2',
          quantity: 3,
        }),
      ],
    });
    (catalog.getProductVariant as jest.Mock)
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(
        snapshot({
          productId: 'product-2',
          variantId: 'variant-2',
          priceCents: 9999,
          stock: 1,
        }),
      );

    const result = await service.get('user-1');

    expect(result.subtotalCents).toBe(5000);
    expect(result.hasUnavailableItems).toBe(true);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        available: true,
        unitPriceCents: 2500,
        lineTotalCents: 5000,
      }),
    );
    expect(result.items[1]).toEqual(
      expect.objectContaining({
        available: false,
        unavailableReason: 'INSUFFICIENT_STOCK',
        lineTotalCents: null,
      }),
    );
  });

  it('refuses an unpublished product before creating a cart', async () => {
    (catalog.getProductVariant as jest.Mock).mockResolvedValue(
      snapshot({ status: 'DRAFT' }),
    );

    await expect(
      service.addOrReplace('user-1', {
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.cart.upsert).not.toHaveBeenCalled();
    expect(prisma.cartItem.upsert).not.toHaveBeenCalled();
  });

  it('scopes quantity updates to the authenticated user cart', async () => {
    (prisma.cartItem.findFirst as jest.Mock).mockResolvedValue(
      item(),
    );
    (catalog.getProductVariant as jest.Mock).mockResolvedValue(
      snapshot(),
    );
    (prisma.cartItem.update as jest.Mock).mockResolvedValue(
      item({ quantity: 4 }),
    );
    (prisma.cart.findUnique as jest.Mock).mockResolvedValue({
      id: 'cart-1',
      userId: 'user-1',
      items: [item({ quantity: 4 })],
    });

    await service.updateQuantity(
      'user-1',
      'variant-1',
      4,
    );

    expect(prisma.cartItem.findFirst).toHaveBeenCalledWith({
      where: {
        variantId: 'variant-1',
        cart: { userId: 'user-1' },
      },
    });
  });
});
