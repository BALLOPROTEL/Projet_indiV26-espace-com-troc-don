import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from './conversations.service';

describe('ConversationsService', () => {
  const conversationApi = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  };
  const messageApi = {
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  };
  const tx = {
    conversation: conversationApi,
    conversationMessage: messageApi,
  };
  const prisma = {
    conversation: conversationApi,
    conversationMessage: messageApi,
    $transaction: jest.fn(
      async (callback: (value: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
  } as unknown as PrismaService;

  const service = new ConversationsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    conversationApi.findFirst.mockResolvedValue({
      id: 'conversation-1',
      ownerId: 'owner-1',
      requesterId: 'requester-1',
    });
    conversationApi.findMany.mockResolvedValue([]);
    conversationApi.update.mockResolvedValue({});
    messageApi.findMany.mockResolvedValue([]);
    messageApi.updateMany.mockResolvedValue({ count: 0 });
    messageApi.count.mockResolvedValue(0);
    messageApi.create.mockImplementation(async ({ data }) => ({
      id: 'message-1',
      createdAt: new Date(),
      readAt: null,
      ...data,
    }));
  });

  it('lists only conversations where the actor is a participant', async () => {
    await service.listMine('requester-1');

    expect(conversationApi.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { ownerId: 'requester-1' },
          { requesterId: 'requester-1' },
        ],
      },
      include: {
        proposal: {
          select: {
            id: true,
            targetListingId: true,
            offeredListingId: true,
            type: true,
            status: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('hides private conversation existence from non-participants', async () => {
    conversationApi.findFirst.mockResolvedValue(null);

    await expect(
      service.listMessages('conversation-1', 'stranger'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(messageApi.findMany).not.toHaveBeenCalled();
  });

  it('paginates messages before a bounded timestamp', async () => {
    await service.listMessages(
      'conversation-1',
      'owner-1',
      '2026-11-20T10:00:00.000Z',
      '20',
    );

    expect(messageApi.findMany).toHaveBeenCalledWith({
      where: {
        conversationId: 'conversation-1',
        createdAt: {
          lt: new Date('2026-11-20T10:00:00.000Z'),
        },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: 20,
    });
  });

  it('trims and persists a participant message atomically', async () => {
    const result = await service.sendMessage(
      'conversation-1',
      'requester-1',
      { body: ' Bonjour ! ' },
    );

    expect(messageApi.count).toHaveBeenCalledWith({
      where: {
        senderId: 'requester-1',
        createdAt: { gte: expect.any(Date) },
      },
    });
    expect(messageApi.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conversation-1',
        senderId: 'requester-1',
        body: 'Bonjour !',
      },
    });
    expect(conversationApi.update).toHaveBeenCalledWith({
      where: { id: 'conversation-1' },
      data: { updatedAt: expect.any(Date) },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'message-1',
        body: 'Bonjour !',
      }),
    );
  });

  it('rejects empty messages', async () => {
    await expect(
      service.sendMessage(
        'conversation-1',
        'requester-1',
        { body: '   ' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(messageApi.create).not.toHaveBeenCalled();
  });

  it('rate-limits message spam per authenticated sender', async () => {
    messageApi.count.mockResolvedValue(20);

    await expect(
      service.sendMessage(
        'conversation-1',
        'requester-1',
        { body: 'Encore un message' },
      ),
    ).rejects.toMatchObject({ status: 429 });

    expect(messageApi.create).not.toHaveBeenCalled();
  });

  it('marks only incoming unread messages as read', async () => {
    messageApi.updateMany.mockResolvedValue({ count: 3 });

    await expect(
      service.markRead('conversation-1', 'owner-1'),
    ).resolves.toEqual({ updated: 3 });

    expect(messageApi.updateMany).toHaveBeenCalledWith({
      where: {
        conversationId: 'conversation-1',
        senderId: { not: 'owner-1' },
        readAt: null,
      },
      data: { readAt: expect.any(Date) },
    });
  });

  it('rejects invalid pagination values', async () => {
    await expect(
      service.listMessages(
        'conversation-1',
        'owner-1',
        undefined,
        '200',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
