import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductStatus,
  ProductStockReservationStatus,
} from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { ReserveProductStockDto } from './dto/reserve-product-stock.dto';

const reservationInclude = {
  items: {
    orderBy: [
      { createdAt: 'asc' as const },
      { id: 'asc' as const },
    ],
  },
};

@Injectable()
export class ProductStockReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(input: ReserveProductStockDto) {
    this.assertUniqueVariants(input);

    return this.withSerializableRetry(async (tx) => {
      const now = new Date();
      await this.releaseExpired(tx, now);

      const existing =
        await tx.productStockReservation.findUnique({
          where: { orderId: input.orderId },
          include: reservationInclude,
        });

      if (
        existing?.status ===
          ProductStockReservationStatus.ACTIVE &&
        existing.expiresAt > now
      ) {
        return existing;
      }

      if (
        existing?.status ===
        ProductStockReservationStatus.COMMITTED
      ) {
        throw new ConflictException(
          'Stock reservation is already committed',
        );
      }

      const variantIds = input.items.map(
        (item) => item.variantId,
      );
      const variants = await tx.productVariant.findMany({
        where: {
          id: { in: variantIds },
        },
        include: {
          product: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (variants.length !== input.items.length) {
        throw new ConflictException(
          'One or more product variants no longer exist',
        );
      }

      const byId = new Map(
        variants.map((variant) => [variant.id, variant]),
      );

      for (const item of input.items) {
        const variant = byId.get(item.variantId);

        if (
          !variant ||
          variant.productId !== item.productId ||
          variant.product.id !== item.productId ||
          variant.product.status !== ProductStatus.PUBLISHED ||
          !variant.active ||
          variant.stock < item.quantity
        ) {
          throw new ConflictException({
            message: 'Product stock cannot be reserved',
            productId: item.productId,
            variantId: item.variantId,
          });
        }
      }

      for (const item of input.items) {
        const updated = await tx.productVariant.updateMany({
          where: {
            id: item.variantId,
            productId: item.productId,
            active: true,
            stock: { gte: item.quantity },
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException({
            message: 'Product stock changed during reservation',
            productId: item.productId,
            variantId: item.variantId,
          });
        }
      }

      const expiresAt = new Date(
        now.getTime() + this.ttlMs(),
      );

      if (existing) {
        await tx.productStockReservationItem.deleteMany({
          where: { reservationId: existing.id },
        });

        return tx.productStockReservation.update({
          where: { id: existing.id },
          data: {
            status: ProductStockReservationStatus.ACTIVE,
            expiresAt,
            items: {
              create: input.items.map((item) => ({
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
              })),
            },
          },
          include: reservationInclude,
        });
      }

      return tx.productStockReservation.create({
        data: {
          orderId: input.orderId,
          status: ProductStockReservationStatus.ACTIVE,
          expiresAt,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
            })),
          },
        },
        include: reservationInclude,
      });
    });
  }

  async release(orderId: string) {
    return this.withSerializableRetry(async (tx) => {
      const reservation =
        await tx.productStockReservation.findUnique({
          where: { orderId },
          include: reservationInclude,
        });

      if (!reservation) {
        throw new NotFoundException(
          'Stock reservation not found',
        );
      }

      if (
        reservation.status ===
          ProductStockReservationStatus.COMMITTED
      ) {
        throw new ConflictException(
          'Committed stock cannot be released',
        );
      }

      if (
        reservation.status !==
        ProductStockReservationStatus.ACTIVE
      ) {
        return reservation;
      }

      await this.restoreItems(tx, reservation.items);

      return tx.productStockReservation.update({
        where: { id: reservation.id },
        data: {
          status: ProductStockReservationStatus.RELEASED,
        },
        include: reservationInclude,
      });
    });
  }

  async commit(orderId: string) {
    return this.withSerializableRetry(async (tx) => {
      const reservation =
        await tx.productStockReservation.findUnique({
          where: { orderId },
          include: reservationInclude,
        });

      if (!reservation) {
        throw new NotFoundException(
          'Stock reservation not found',
        );
      }

      if (
        reservation.status ===
          ProductStockReservationStatus.COMMITTED
      ) {
        return reservation;
      }

      if (
        reservation.status !==
          ProductStockReservationStatus.ACTIVE
      ) {
        throw new ConflictException(
          'Only an active reservation can be committed',
        );
      }

      if (reservation.expiresAt <= new Date()) {
        await this.restoreItems(tx, reservation.items);
        await tx.productStockReservation.update({
          where: { id: reservation.id },
          data: {
            status: ProductStockReservationStatus.EXPIRED,
          },
        });

        throw new ConflictException(
          'Stock reservation has expired',
        );
      }

      return tx.productStockReservation.update({
        where: { id: reservation.id },
        data: {
          status: ProductStockReservationStatus.COMMITTED,
        },
        include: reservationInclude,
      });
    });
  }

  private async releaseExpired(
    tx: Prisma.TransactionClient,
    now: Date,
  ): Promise<void> {
    const expired =
      await tx.productStockReservation.findMany({
        where: {
          status: ProductStockReservationStatus.ACTIVE,
          expiresAt: { lte: now },
        },
        include: reservationInclude,
      });

    for (const reservation of expired) {
      await this.restoreItems(tx, reservation.items);
      await tx.productStockReservation.update({
        where: { id: reservation.id },
        data: {
          status: ProductStockReservationStatus.EXPIRED,
        },
      });
    }
  }

  private async restoreItems(
    tx: Prisma.TransactionClient,
    items: Array<{
      variantId: string;
      quantity: number;
    }>,
  ): Promise<void> {
    for (const item of items) {
      await tx.productVariant.updateMany({
        where: { id: item.variantId },
        data: {
          stock: {
            increment: item.quantity,
          },
        },
      });
    }
  }

  private assertUniqueVariants(
    input: ReserveProductStockDto,
  ): void {
    const ids = input.items.map((item) => item.variantId);

    if (new Set(ids).size !== ids.length) {
      throw new ConflictException(
        'A reservation cannot repeat the same variant',
      );
    }
  }

  private ttlMs(): number {
    const seconds = Number(
      process.env.PRODUCT_RESERVATION_TTL_SECONDS ?? '900',
    );
    const safeSeconds =
      Number.isFinite(seconds) &&
      seconds >= 60 &&
      seconds <= 3600
        ? seconds
        : 900;

    return safeSeconds * 1000;
  }

  private async withSerializableRetry<T>(
    operation: (
      tx: Prisma.TransactionClient,
    ) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const retryable =
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2034';

        if (!retryable || attempt === 3) {
          throw error;
        }
      }
    }

    throw new Error('Unreachable serializable transaction state');
  }
}
