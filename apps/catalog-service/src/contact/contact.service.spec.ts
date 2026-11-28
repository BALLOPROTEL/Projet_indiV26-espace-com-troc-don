import { HttpException } from '@nestjs/common';
import {
  ContactStatus,
  ContactSubject,
  PrivacyAction,
} from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import { ContactService } from './contact.service';

describe('ContactService', () => {
  const prisma = {
    contactMessage: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;
  const service = new ContactService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('normalizes public contact email and never invents a user id', async () => {
    (prisma.contactMessage.count as jest.Mock).mockResolvedValue(0);
    (prisma.contactMessage.create as jest.Mock).mockResolvedValue({ id: 'c-1' });

    await service.createPublic({
      name: ' Test User ',
      email: 'USER@Example.FR ',
      subject: ContactSubject.ACCOUNT,
      message: 'Une demande de support suffisamment longue.',
    });

    expect(prisma.contactMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Test User',
          email: 'user@example.fr',
        }),
      }),
    );
  });

  it('rate limits repeated anonymous submissions', async () => {
    (prisma.contactMessage.count as jest.Mock).mockResolvedValue(5);

    await expect(
      service.createPublic({
        name: 'Test User',
        email: 'user@example.fr',
        subject: ContactSubject.OTHER,
        message: 'Une demande de support suffisamment longue.',
      }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
  });

  it('binds privacy requests to the authenticated JWT subject', async () => {
    (prisma.contactMessage.count as jest.Mock).mockResolvedValue(0);
    (prisma.contactMessage.create as jest.Mock).mockResolvedValue({ id: 'p-1' });

    await service.createPrivacyRequest(
      'user-sub-1',
      'demo-user',
      {
        action: PrivacyAction.ANONYMIZE,
        message: 'Je souhaite anonymiser les données applicatives concernées.',
      },
    );

    expect(prisma.contactMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-sub-1',
          subject: ContactSubject.PRIVACY,
          privacyAction: PrivacyAction.ANONYMIZE,
        }),
      }),
    );
  });

  it('updates contact workflow status only for an existing request', async () => {
    (prisma.contactMessage.findUnique as jest.Mock).mockResolvedValue({ id: 'c-1' });
    (prisma.contactMessage.update as jest.Mock).mockResolvedValue({
      id: 'c-1',
      status: ContactStatus.CLOSED,
    });

    await service.updateStatus('c-1', ContactStatus.CLOSED);
    expect(prisma.contactMessage.update).toHaveBeenCalledWith({
      where: { id: 'c-1' },
      data: { status: ContactStatus.CLOSED },
    });
  });
});
