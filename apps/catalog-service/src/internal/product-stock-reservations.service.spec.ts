import { ConflictException } from '@nestjs/common';
import {
  ProductStatus,
  ProductStockReservationStatus,
} from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import { ProductStockReservationsService } from './product-stock-reservations.service';

describe('ProductStockReservationsService', () => {
  const tx = {
    productStockReservation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    productStockReservationItem: {
      deleteMany: jest.fn(),
    },
    productVariant: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(
      async (
        operation: (client: typeof tx) => Promise<unknown>,
      ) => operation(tx),
    ),
  } as unknown as PrismaService;

  const service =
    new ProductStockReservationsService(prisma);

  const input = {
    orderId: 'order-1',
    items: [
      {
        productId: 'product-1',
        variantId: 'variant-1',
        quantity: 2,
      },
      {
        productId: 'product-2',
        variantId: 'variant-2',
        quantity: 1,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tx.productStockReservation.findMany.mockResolvedValue([]);
    tx.productStockReservation.findUnique.mockResolvedValue(null);
  });

  it('decrements every requested variant exactly once on a successful reservation', async () => {
    tx.productVariant.findMany.mockResolvedValue([
      {
        id: 'variant-1',
        productId: 'product-1',
        active: true,
        stock: 5,
        product: {
          id: 'product-1',
          status: ProductStatus.PUBLISHED,
        },
      },
      {
        id: 'variant-2',
        productId: 'product-2',
        active: true,
        stock: 3,
        product: {
          id: 'product-2',
          status: ProductStatus.PUBLISHED,
        },
      },
    ]);
    tx.productVariant.updateMany.mockResolvedValue({
      count: 1,
    });
    tx.productStockReservation.create.mockResolvedValue({
      id: 'reservation-1',
      orderId: 'order-1',
      status: ProductStockReservationStatus.ACTIVE,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      items: [],
    });

    await service.reserve(input);

    expect(tx.productVariant.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.productVariant.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'variant-1',
          stock: { gte: 2 },
        }),
        data: {
          stock: { decrement: 2 },
        },
      }),
    );
    expect(tx.productVariant.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'variant-2',
          stock: { gte: 1 },
        }),
        data: {
          stock: { decrement: 1 },
        },
      }),
    );
  });

  it('refuses the whole reservation before any decrement when one line lacks stock', async () => {
    tx.productVariant.findMany.mockResolvedValue([
      {
        id: 'variant-1',
        productId: 'product-1',
        active: true,
        stock: 5,
        product: {
          id: 'product-1',
          status: ProductStatus.PUBLISHED,
        },
      },
      {
        id: 'variant-2',
        productId: 'product-2',
        active: true,
        stock: 0,
        product: {
          id: 'product-2',
          status: ProductStatus.PUBLISHED,
        },
      },
    ]);

    await expect(
      service.reserve(input),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.productVariant.updateMany).not.toHaveBeenCalled();
    expect(
      tx.productStockReservation.create,
    ).not.toHaveBeenCalled();
  });

  it('releases an active reservation by restoring every quantity once', async () => {
    tx.productStockReservation.findUnique.mockResolvedValue({
      id: 'reservation-1',
      orderId: 'order-1',
      status: ProductStockReservationStatus.ACTIVE,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      items: [
        {
          id: 'line-1',
          reservationId: 'reservation-1',
          productId: 'product-1',
          variantId: 'variant-1',
          quantity: 2,
          createdAt: new Date(),
        },
      ],
    });
    tx.productVariant.updateMany.mockResolvedValue({
      count: 1,
    });
    tx.productStockReservation.update.mockResolvedValue({
      id: 'reservation-1',
      orderId: 'order-1',
      status: ProductStockReservationStatus.RELEASED,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      items: [],
    });

    await service.release('order-1');

    expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: {
        stock: { increment: 2 },
      },
    });
    expect(tx.productStockReservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: ProductStockReservationStatus.RELEASED,
        },
      }),
    );
  });
});
