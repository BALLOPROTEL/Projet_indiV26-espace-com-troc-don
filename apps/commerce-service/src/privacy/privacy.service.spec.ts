import type { PrismaService } from '../prisma/prisma.service';
import { PrivacyService } from './privacy.service';

describe('Commerce PrivacyService', () => {
  const tx = {
    cart: { deleteMany: jest.fn() },
    order: { updateMany: jest.fn() },
  };
  const prisma = {
    order: {
      count: jest.fn(),
    },
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  } as unknown as PrismaService;
  const service = new PrivacyService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.cart.deleteMany.mockResolvedValue({ count: 1 });
    tx.order.updateMany.mockResolvedValue({ count: 2 });
    (prisma.order.count as jest.Mock).mockResolvedValue(0);
  });

  it('deletes the cart and neutralizes personal order fields without deleting orders', async () => {
    const replacement =
      'anon-commerce-00000000-0000-4000-8000-000000000001';

    const result = await service.anonymize('user-sub-1', replacement);

    expect(tx.cart.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-sub-1' },
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-sub-1' },
      data: {
        userId: replacement,
        recipientFirstName: 'Compte',
        recipientLastName: 'Anonymisé',
        email: replacement + '@invalid.local',
        addressLine1: 'Supprimée',
        postalCode: '00000',
        city: 'Supprimée',
        countryCode: 'ZZ',
        paymentSessionId: null,
        paymentIntentId: null,
      },
    });
    expect(result).toEqual({
      cartsRemoved: 1,
      ordersAnonymized: 2,
    });
  });

  it('blocks anonymization while an order is awaiting payment', async () => {
    (prisma.order.count as jest.Mock).mockResolvedValue(1);

    await expect(
      service.anonymize(
        'user-sub-1',
        'anon-commerce-00000000-0000-4000-8000-000000000001',
      ),
    ).rejects.toThrow(
      'Order awaiting payment must be cancelled or expired before anonymization',
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects arbitrary replacement identities', async () => {
    await expect(
      service.anonymize('user-sub-1', 'other-user'),
    ).rejects.toThrow(
      'Invalid commerce anonymization replacement id',
    );
  });
});
