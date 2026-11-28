import { EditorialStatus } from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';
import { EditorialService } from './editorial.service';

describe('EditorialService', () => {
  const prisma = {
    fanzine: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    festivalEntry: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;
  const service = new EditorialService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('exposes only published fanzines publicly', async () => {
    (prisma.fanzine.findMany as jest.Mock).mockResolvedValue([]);
    await service.findPublicFanzines();
    expect(prisma.fanzine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: EditorialStatus.PUBLISHED },
      }),
    );
  });

  it('creates fanzines as draft through Prisma defaults', async () => {
    (prisma.fanzine.create as jest.Mock).mockResolvedValue({ id: 'f-1' });
    await service.createFanzine({
      slug: 'numero-test',
      title: 'Numéro test',
      excerpt: 'Résumé suffisamment long pour le test.',
      body: 'Contenu éditorial suffisamment long pour le test unitaire.',
    });
    expect(prisma.fanzine.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({
        status: EditorialStatus.PUBLISHED,
      }),
    });
  });

  it('publishes an existing fanzine explicitly', async () => {
    (prisma.fanzine.findUnique as jest.Mock).mockResolvedValue({
      id: 'f-1',
      status: EditorialStatus.DRAFT,
      publishedAt: null,
    });
    (prisma.fanzine.update as jest.Mock).mockResolvedValue({
      id: 'f-1',
      status: EditorialStatus.PUBLISHED,
    });
    await service.publishFanzine('f-1');
    expect(prisma.fanzine.update).toHaveBeenCalledWith({
      where: { id: 'f-1' },
      data: {
        status: EditorialStatus.PUBLISHED,
        publishedAt: expect.any(Date),
      },
    });
  });

  it('rejects an inverted festival date range', async () => {
    await expect(
      service.createFestivalEntry({
        slug: 'festival-test',
        title: 'Festival test',
        summary: 'Résumé assez long pour cette actualité.',
        body: 'Contenu complet suffisamment long pour ce test de festival.',
        startsAt: '2026-12-10T20:00:00.000Z',
        endsAt: '2026-12-10T18:00:00.000Z',
      }),
    ).rejects.toThrow('endsAt must be after or equal to startsAt');
  });
});
