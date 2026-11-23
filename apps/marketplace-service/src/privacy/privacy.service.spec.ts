import type { PrismaService } from '../prisma/prisma.service';
import { PrivacyService } from './privacy.service';

describe('Marketplace PrivacyService', () => {
  const tx = {
    proposal: { updateMany: jest.fn() },
    marketplaceTransaction: { updateMany: jest.fn() },
    conversation: { updateMany: jest.fn() },
    conversationMessage: { updateMany: jest.fn() },
    $executeRawUnsafe: jest.fn(),
  };
  const prisma = {
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  } as unknown as PrismaService;
  const service = new PrivacyService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.proposal.updateMany.mockResolvedValue({ count: 1 });
    tx.marketplaceTransaction.updateMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 3 });
    tx.conversation.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    tx.conversationMessage.updateMany.mockResolvedValue({ count: 4 });
    tx.$executeRawUnsafe.mockResolvedValue(2);
  });

  it('anonymizes requester/participant ids and redacts message bodies', async () => {
    const result = await service.anonymize(
      'user-sub-1',
      'anon-marketplace-00000000-0000-4000-8000-000000000001',
    );

    expect(tx.proposal.updateMany).toHaveBeenCalledWith({
      where: { requesterId: 'user-sub-1' },
      data: {
        requesterId:
          'anon-marketplace-00000000-0000-4000-8000-000000000001',
        message: null,
      },
    });
    expect(tx.conversationMessage.updateMany).toHaveBeenCalledWith({
      where: { senderId: 'user-sub-1' },
      data: {
        senderId:
          'anon-marketplace-00000000-0000-4000-8000-000000000001',
        body: '[message anonymisé à la demande du compte]',
      },
    });
    expect(result.messages).toBe(4);
    expect(result.outboxEventsRemoved).toBe(2);
  });

  it('rejects replacement ids outside the dedicated namespace', async () => {
    await expect(
      service.anonymize('user-sub-1', 'user-sub-2'),
    ).rejects.toThrow(
      'Invalid marketplace anonymization replacement id',
    );
  });
});
