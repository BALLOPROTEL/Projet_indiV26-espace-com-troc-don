import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ContactStatus,
  ContactSubject,
  PrivacyAction,
  PrivacyExecutionStatus,
} from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import { PrivacyExecutionService } from './privacy-execution.service';

describe('PrivacyExecutionService', () => {
  const prisma = {
    contactMessage: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    privacyExecution: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        INTERNAL_SERVICE_TOKEN: 'internal-test-token-long-enough',
        MARKETPLACE_INTERNAL_URL: 'http://marketplace:3102',
        NOTIFICATION_INTERNAL_URL: 'http://notification:3103',
        COMMERCE_INTERNAL_URL: 'http://commerce:3104',
      };
      return values[key];
    }),
  } as unknown as ConfigService;

  const service = new PrivacyExecutionService(prisma, config);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses a normal contact message that is not a privacy anonymization request', async () => {
    (prisma.contactMessage.findUnique as jest.Mock).mockResolvedValue({
      id: 'contact-1',
      userId: 'user-sub-1',
      subject: ContactSubject.ACCOUNT,
      privacyAction: null,
      status: ContactStatus.NEW,
    });

    await expect(
      service.execute('contact-1', 'admin-sub'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns an already completed execution without calling remote services again', async () => {
    const completed = {
      id: 'privacy-1',
      contactMessageId: 'contact-1',
      originalUserId: null,
      catalogReplacementId:
        'anon-catalog-00000000-0000-4000-8000-000000000001',
      marketplaceReplacementId:
        'anon-marketplace-00000000-0000-4000-8000-000000000002',
      commerceReplacementId:
        'anon-commerce-00000000-0000-4000-8000-000000000003',
      reviewerId: 'admin-sub',
      status: PrivacyExecutionStatus.COMPLETED,
      lastError: null,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.contactMessage.findUnique as jest.Mock).mockResolvedValue({
      id: 'contact-1',
      userId: 'user-sub-1',
      subject: ContactSubject.PRIVACY,
      privacyAction: PrivacyAction.ANONYMIZE,
      status: ContactStatus.CLOSED,
    });
    (prisma.privacyExecution.findUnique as jest.Mock)
      .mockResolvedValue(completed);

    await expect(
      service.execute('contact-1', 'admin-sub'),
    ).resolves.toEqual({
      execution: completed,
      catalog: {
        listingsAnonymized: 0,
        favoritesRemoved: 0,
        reportsAnonymized: 0,
        contactMessagesRedacted: 0,
      },
      identityDeletionRequired: false,
      alreadyCompleted: true,
    });

    expect(prisma.privacyExecution.create).not.toHaveBeenCalled();
    expect(prisma.privacyExecution.update).not.toHaveBeenCalled();
  });
});
