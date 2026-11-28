import type { NotificationPrismaService } from '../prisma/prisma.service';
import { PrivacyService } from './privacy.service';

describe('Notification PrivacyService', () => {
  const prisma = {
    $executeRaw: jest.fn(),
  } as unknown as NotificationPrismaService;
  const service = new PrivacyService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('removes notification events that identify the account', async () => {
    (prisma.$executeRaw as jest.Mock).mockResolvedValue(3);

    await expect(
      service.anonymize('user-sub-1'),
    ).resolves.toEqual({ eventsRemoved: 3 });

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
