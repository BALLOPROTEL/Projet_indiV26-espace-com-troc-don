import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CartService } from '../cart/cart.service';
import { CatalogClientService } from '../catalog/catalog-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly catalog: CatalogClientService,
  ) {}

  async createDraft(
    userId: string,
    idempotencyKey: string,
    input: CreateOrderDto,
  ) {
    const existing = await this.findByIdempotency(
      userId,
      idempotencyKey,
    );
    if (existing) {
      return this.toView(existing);
    }

    const cart = await this.cart.get(userId);

    if (cart.items.length === 0) {
      throw new BadRequestException(
        'Cart is empty',
      );
    }

    if (cart.hasUnavailableItems) {
      throw new ConflictException(
        'Cart contains unavailable items',
      );
    }

    const items = cart.items.map((item) => {
      if (
        !item.productName ||
        !item.productSlug ||
        !item.variantLabel ||
        item.unitPriceCents === null ||
        item.lineTotalCents === null
      ) {
        throw new ConflictException(
          'Cart contains incomplete product data',
        );
      }

      return {
        productId: item.productId,
        variantId: item.variantId,
        productSlug: item.productSlug,
        productName: item.productName,
        variantLabel: item.variantLabel,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        lineTotalCents: item.lineTotalCents,
      };
    });

    try {
      const created = await this.prisma.order.create({
        data: {
          userId,
          status: 'DRAFT',
          currency: 'EUR',
          subtotalCents: cart.subtotalCents,
          idempotencyKey,
          recipientFirstName: input.recipientFirstName.trim(),
          recipientLastName: input.recipientLastName.trim(),
          email: input.email.trim().toLowerCase(),
          addressLine1: input.addressLine1.trim(),
          postalCode: input.postalCode.trim(),
          city: input.city.trim(),
          countryCode: input.countryCode.trim().toUpperCase(),
          items: {
            create: items,
          },
        },
        include: {
          items: {
            orderBy: [
              { createdAt: 'asc' },
              { id: 'asc' },
            ],
          },
        },
      });

      return this.toView(created);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        const replay = await this.findByIdempotency(
          userId,
          idempotencyKey,
        );
        if (replay) {
          return this.toView(replay);
        }
      }

      throw error;
    }
  }

  async reserve(
    userId: string,
    id: string,
  ) {
    const order = await this.requireOwned(userId, id);

    if (order.status === 'AWAITING_PAYMENT') {
      if (
        order.reservationExpiresAt &&
        order.reservationExpiresAt > new Date()
      ) {
        return this.toView(order);
      }

      return this.toView(
        await this.reconcileExpiration(order),
      );
    }

    if (order.status !== 'DRAFT') {
      throw new ConflictException(
        'Only a draft order can reserve stock',
      );
    }

    const reservation = await this.catalog.reserveStock(
      order.id,
      order.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    );

    try {
      const updated = await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'AWAITING_PAYMENT',
          reservationExpiresAt: new Date(
            reservation.expiresAt,
          ),
        },
        include: {
          items: {
            orderBy: [
              { createdAt: 'asc' },
              { id: 'asc' },
            ],
          },
        },
      });

      return this.toView(updated);
    } catch (error) {
      try {
        await this.catalog.releaseStock(order.id);
      } catch {
        // Best-effort compensation. A retry can reconcile later.
      }
      throw error;
    }
  }

  async cancel(
    userId: string,
    id: string,
  ) {
    const order = await this.requireOwned(userId, id);

    if (
      order.status === 'CANCELLED' ||
      order.status === 'EXPIRED'
    ) {
      return this.toView(order);
    }

    if (order.status === 'AWAITING_PAYMENT') {
      await this.catalog.releaseStock(order.id);
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
      },
      include: {
        items: {
          orderBy: [
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
        },
      },
    });

    return this.toView(updated);
  }

  async list(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          orderBy: [
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
        },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });

    const reconciled = await Promise.all(
      orders.map((order) =>
        this.reconcileExpiration(order),
      ),
    );

    return reconciled.map((order) => this.toView(order));
  }

  async get(userId: string, id: string) {
    const order = await this.requireOwned(userId, id);
    const reconciled = await this.reconcileExpiration(order);

    return this.toView(reconciled);
  }

  private async requireOwned(
    userId: string,
    id: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        items: {
          orderBy: [
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  private async reconcileExpiration<
    T extends {
      id: string;
      status: string;
      reservationExpiresAt: Date | null;
    },
  >(order: T): Promise<T> {
    if (
      order.status !== 'AWAITING_PAYMENT' ||
      !order.reservationExpiresAt ||
      order.reservationExpiresAt > new Date()
    ) {
      return order;
    }

    await this.catalog.releaseStock(order.id);

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'EXPIRED',
      },
      include: {
        items: {
          orderBy: [
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
        },
      },
    });

    return updated as unknown as T;
  }

  private toView<
    T extends {
      userId: string;
      idempotencyKey: string;
    },
  >(order: T): Omit<T, 'userId' | 'idempotencyKey'> {
    const view = { ...order } as Record<string, unknown>;
    delete view.userId;
    delete view.idempotencyKey;

    return view as unknown as Omit<
      T,
      'userId' | 'idempotencyKey'
    >;
  }

  private findByIdempotency(
    userId: string,
    idempotencyKey: string,
  ) {
    return this.prisma.order.findUnique({
      where: {
        userId_idempotencyKey: {
          userId,
          idempotencyKey,
        },
      },
      include: {
        items: {
          orderBy: [
            { createdAt: 'asc' as const },
            { id: 'asc' as const },
          ],
        },
      },
    });
  }
}
