import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { CartService } from '../cart/cart.service';
import type { CatalogClientService } from '../catalog/catalog-client.service';
import type { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const prisma = {
    order: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const cart = {
    get: jest.fn(),
  } as unknown as CartService;

  const catalog = {
    reserveStock: jest.fn(),
    releaseStock: jest.fn(),
  } as unknown as CatalogClientService;

  const service = new OrdersService(prisma, cart, catalog);

  const input = {
    recipientFirstName: 'Ada',
    recipientLastName: 'Lovelace',
    email: 'ADA@example.test',
    addressLine1: '1 rue du Test',
    postalCode: '75001',
    city: 'Paris',
    countryCode: 'FR',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);
  });

  it('refuses an empty cart before writing an order', async () => {
    (cart.get as jest.Mock).mockResolvedValue({
      items: [],
      currency: 'EUR',
      subtotalCents: 0,
      hasUnavailableItems: false,
    });

    await expect(
      service.createDraft('user-1', 'idem-key-1', input),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('refuses a cart containing an unavailable product', async () => {
    (cart.get as jest.Mock).mockResolvedValue({
      items: [{
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 2,
        productName: 'Produit',
        productSlug: 'produit',
        variantLabel: 'Standard',
        currency: 'EUR',
        unitPriceCents: 2500,
        stock: 1,
        available: false,
        unavailableReason: 'INSUFFICIENT_STOCK',
        lineTotalCents: null,
        imageUrl: null,
      }],
      currency: 'EUR',
      subtotalCents: 0,
      hasUnavailableItems: true,
    });

    await expect(
      service.createDraft('user-1', 'idem-key-2', input),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('freezes product and price snapshots without clearing the cart', async () => {
    (cart.get as jest.Mock).mockResolvedValue({
      items: [{
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 2,
        productName: 'Produit réel',
        productSlug: 'produit-reel',
        variantLabel: 'Standard',
        currency: 'EUR',
        unitPriceCents: 2599,
        stock: 5,
        available: true,
        unavailableReason: null,
        lineTotalCents: 5198,
        imageUrl: '/api/products/product-1/images/image-1/content',
      }],
      currency: 'EUR',
      subtotalCents: 5198,
      hasUnavailableItems: false,
    });
    (prisma.order.create as jest.Mock).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'DRAFT',
      subtotalCents: 5198,
      items: [],
    });

    await service.createDraft('user-1', 'idem-key-3', input);

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          subtotalCents: 5198,
          email: 'ada@example.test',
          items: {
            create: [{
              productId: 'product-1',
              variantId: 'variant-1',
              productSlug: 'produit-reel',
              productName: 'Produit réel',
              variantLabel: 'Standard',
              unitPriceCents: 2599,
              quantity: 2,
              lineTotalCents: 5198,
            }],
          },
        }),
      }),
    );
  });

  it('replays the same order for the same idempotency key without rereading cart state', async () => {
    const existing = {
      id: 'order-existing',
      userId: 'user-1',
      status: 'DRAFT',
      items: [],
    };
    (prisma.order.findUnique as jest.Mock).mockResolvedValue(existing);

    await expect(
      service.createDraft('user-1', 'idem-key-4', input),
    ).resolves.toEqual({
      id: 'order-existing',
      status: 'DRAFT',
      items: [],
    });

    expect(cart.get).not.toHaveBeenCalled();
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('does not expose an order owned by another user', async () => {
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.get('user-2', 'order-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'order-1',
          userId: 'user-2',
        },
      }),
    );
  });


  it('moves a draft to AWAITING_PAYMENT only after Catalog reserves stock', async () => {
    const order = {
      id: 'order-1',
      userId: 'user-1',
      idempotencyKey: 'idem-1',
      status: 'DRAFT',
      reservationExpiresAt: null,
      items: [{
        id: 'item-1',
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 2,
      }],
    };
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(order);
    (catalog.reserveStock as jest.Mock).mockResolvedValue({
      id: 'reservation-1',
      orderId: 'order-1',
      status: 'ACTIVE',
      expiresAt: '2026-11-21T02:00:00.000Z',
      items: [],
    });
    (prisma.order.update as jest.Mock).mockResolvedValue({
      ...order,
      status: 'AWAITING_PAYMENT',
      reservationExpiresAt: new Date('2026-11-21T02:00:00.000Z'),
    });

    const result = await service.reserve('user-1', 'order-1');

    expect(catalog.reserveStock).toHaveBeenCalledWith(
      'order-1',
      [{
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 2,
      }],
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'order-1',
        status: 'AWAITING_PAYMENT',
      }),
    );
  });

  it('releases Catalog stock before marking an awaiting order cancelled', async () => {
    const order = {
      id: 'order-1',
      userId: 'user-1',
      idempotencyKey: 'idem-1',
      status: 'AWAITING_PAYMENT',
      reservationExpiresAt: new Date('2099-01-01T00:00:00.000Z'),
      items: [],
    };
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(order);
    (catalog.releaseStock as jest.Mock).mockResolvedValue({
      id: 'reservation-1',
      orderId: 'order-1',
      status: 'RELEASED',
      expiresAt: '2099-01-01T00:00:00.000Z',
      items: [],
    });
    (prisma.order.update as jest.Mock).mockResolvedValue({
      ...order,
      status: 'CANCELLED',
    });

    const result = await service.cancel('user-1', 'order-1');

    expect(catalog.releaseStock).toHaveBeenCalledWith('order-1');
    expect(result).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
      }),
    );
  });
});
