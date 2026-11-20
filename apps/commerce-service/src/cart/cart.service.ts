import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CartItem } from '../../generated/prisma';
import {
  CatalogClientService,
} from '../catalog/catalog-client.service';
import type {
  CatalogProductVariantSnapshot,
} from '../catalog/catalog-contract';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';

export type CartUnavailableReason =
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_NOT_PUBLISHED'
  | 'VARIANT_INACTIVE'
  | 'INSUFFICIENT_STOCK';

export type CartItemView = {
  productId: string;
  variantId: string;
  quantity: number;
  productName: string | null;
  productSlug: string | null;
  variantLabel: string | null;
  currency: 'EUR' | null;
  unitPriceCents: number | null;
  stock: number | null;
  available: boolean;
  unavailableReason: CartUnavailableReason | null;
  lineTotalCents: number | null;
  imageUrl: string | null;
};

export type CartView = {
  items: CartItemView[];
  currency: 'EUR';
  subtotalCents: number;
  hasUnavailableItems: boolean;
};

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogClientService,
  ) {}

  async get(userId: string): Promise<CartView> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: [
            { createdAt: 'asc' },
            { id: 'asc' },
          ],
        },
      },
    });

    if (!cart) {
      return this.empty();
    }

    const items = await Promise.all(
      cart.items.map((item) => this.hydrate(item)),
    );

    return {
      items,
      currency: 'EUR',
      subtotalCents: items.reduce(
        (sum, item) => sum + (item.lineTotalCents ?? 0),
        0,
      ),
      hasUnavailableItems: items.some(
        (item) => !item.available,
      ),
    };
  }

  async addOrReplace(
    userId: string,
    input: AddCartItemDto,
  ): Promise<CartView> {
    const snapshot = await this.catalog.getProductVariant(
      input.productId,
      input.variantId,
    );
    this.assertPurchasable(snapshot, input.quantity);

    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true },
    });

    await this.prisma.cartItem.upsert({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId: input.variantId,
        },
      },
      create: {
        cartId: cart.id,
        productId: input.productId,
        variantId: input.variantId,
        quantity: input.quantity,
      },
      update: {
        productId: input.productId,
        quantity: input.quantity,
      },
    });

    return this.get(userId);
  }

  async updateQuantity(
    userId: string,
    variantId: string,
    quantity: number,
  ): Promise<CartView> {
    const item = await this.prisma.cartItem.findFirst({
      where: {
        variantId,
        cart: { userId },
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    const snapshot = await this.catalog.getProductVariant(
      item.productId,
      item.variantId,
    );
    this.assertPurchasable(snapshot, quantity);

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity },
    });

    return this.get(userId);
  }

  async remove(
    userId: string,
    variantId: string,
  ): Promise<CartView> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) {
      return this.empty();
    }

    await this.prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        variantId,
      },
    });

    return this.get(userId);
  }

  async clear(userId: string): Promise<CartView> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) {
      return this.empty();
    }

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return this.empty();
  }

  private async hydrate(
    item: CartItem,
  ): Promise<CartItemView> {
    try {
      const snapshot = await this.catalog.getProductVariant(
        item.productId,
        item.variantId,
      );
      const unavailableReason = this.unavailableReason(
        snapshot,
        item.quantity,
      );
      const available = unavailableReason === null;

      return {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        productName: snapshot.name,
        productSlug: snapshot.slug,
        variantLabel: snapshot.variantLabel,
        currency: 'EUR',
        unitPriceCents: snapshot.priceCents,
        stock: snapshot.stock,
        available,
        unavailableReason,
        lineTotalCents: available
          ? snapshot.priceCents * item.quantity
          : null,
        imageUrl:
          snapshot.status === 'PUBLISHED' &&
          snapshot.primaryImageId
            ? `/api/products/${snapshot.productId}/images/${snapshot.primaryImageId}/content`
            : null,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          productName: null,
          productSlug: null,
          variantLabel: null,
          currency: null,
          unitPriceCents: null,
          stock: null,
          available: false,
          unavailableReason: 'PRODUCT_NOT_FOUND',
          lineTotalCents: null,
          imageUrl: null,
        };
      }

      throw error;
    }
  }

  private assertPurchasable(
    snapshot: CatalogProductVariantSnapshot,
    quantity: number,
  ): void {
    const reason = this.unavailableReason(snapshot, quantity);

    if (reason) {
      throw new ConflictException({
        message: 'Product variant is not purchasable',
        reason,
      });
    }
  }

  private unavailableReason(
    snapshot: CatalogProductVariantSnapshot,
    quantity: number,
  ): CartUnavailableReason | null {
    if (snapshot.status !== 'PUBLISHED') {
      return 'PRODUCT_NOT_PUBLISHED';
    }

    if (!snapshot.active) {
      return 'VARIANT_INACTIVE';
    }

    if (snapshot.stock < quantity) {
      return 'INSUFFICIENT_STOCK';
    }

    return null;
  }

  private empty(): CartView {
    return {
      items: [],
      currency: 'EUR',
      subtotalCents: 0,
      hasUnavailableItems: false,
    };
  }
}
