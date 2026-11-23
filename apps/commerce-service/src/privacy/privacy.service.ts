import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async anonymize(userId: string, replacementId: string) {
    this.assertReplacement(replacementId);

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
