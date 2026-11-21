import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { CartService } from '../cart/cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
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
        error instanceof Prisma.PrismaClientKnownRequestError &&
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

    return orders.map((order) => this.toView(order));
  }

  async get(userId: string, id: string) {
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

    return this.toView(order);
  }

  private toView<
    T extends {
      userId: string;
      idempotencyKey: string;
    },
  >(order: T): Omit<T, 'userId' | 'idempotencyKey'> {
    const {
      userId: _userId,
      idempotencyKey: _idempotencyKey,
      ...view
    } = order;

    return view;
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
