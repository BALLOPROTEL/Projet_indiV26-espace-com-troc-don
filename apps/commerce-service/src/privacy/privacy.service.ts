import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { OrderStatus } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async preflight(userId: string) {
    const awaitingPaymentOrders = await this.prisma.order.count({
      where: {
        userId,
        status: OrderStatus.AWAITING_PAYMENT,
      },
    });

    return {
      canAnonymize: awaitingPaymentOrders === 0,
      awaitingPaymentOrders,
    };
  }

  async anonymize(userId: string, replacementId: string) {
    this.assertReplacement(replacementId);

    const preflight = await this.preflight(userId);
    if (!preflight.canAnonymize) {
      throw new ConflictException(
        'Order awaiting payment must be cancelled or expired before anonymization',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const carts = await tx.cart.deleteMany({
        where: { userId },
      });
      const orders = await tx.order.updateMany({
        where: { userId },
        data: {
          userId: replacementId,
          recipientFirstName: 'Compte',
          recipientLastName: 'Anonymisé',
          email: replacementId + '@invalid.local',
          addressLine1: 'Supprimée',
          postalCode: '00000',
          city: 'Supprimée',
          countryCode: 'ZZ',
          paymentSessionId: null,
          paymentIntentId: null,
        },
      });

      return {
        cartsRemoved: carts.count,
        ordersAnonymized: orders.count,
      };
    });
  }

  private assertReplacement(value: string): void {
    if (!/^anon-commerce-[0-9a-f-]{36}$/.test(value)) {
      throw new BadRequestException(
        'Invalid commerce anonymization replacement id',
      );
    }
  }
}
