import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EditorialStatus } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFanzineDto,
  CreateFestivalEntryDto,
  UpdateFanzineDto,
  UpdateFestivalEntryDto,
} from './dto/editorial.dto';

@Injectable()
export class EditorialService {
  constructor(private readonly prisma: PrismaService) {}

  findPublicFanzines() {
    return this.prisma.fanzine.findMany({
      where: { status: EditorialStatus.PUBLISHED },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findPublicFanzine(slug: string) {
    const item = await this.prisma.fanzine.findFirst({
      where: { slug, status: EditorialStatus.PUBLISHED },
    });
    if (!item) throw new NotFoundException('Fanzine not found');
    return item;
  }

  findAdminFanzines() {
    return this.prisma.fanzine.findMany({
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
  }

  async createFanzine(input: CreateFanzineDto) {
    try {
      return await this.prisma.fanzine.create({
        data: {
          slug: input.slug,
          title: input.title.trim(),
          excerpt: input.excerpt.trim(),
          body: input.body.trim(),
          issueLabel: input.issueLabel?.trim() || null,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Fanzine slug already exists');
    }
  }

  async updateFanzine(id: string, input: UpdateFanzineDto) {
    const existing = await this.requireFanzine(id);
    if (existing.status === EditorialStatus.ARCHIVED) {
      throw new ConflictException('Archived fanzines cannot be edited');
    }
    this.requireEditableInput(input);
    try {
      return await this.prisma.fanzine.update({
        where: { id },
        data: {
          slug: input.slug,
          title: input.title?.trim(),
          excerpt: input.excerpt?.trim(),
          body: input.body?.trim(),
          issueLabel:
            input.issueLabel === undefined
              ? undefined
              : input.issueLabel.trim() || null,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Fanzine slug already exists');
    }
  }

  async publishFanzine(id: string) {
    const existing = await this.requireFanzine(id);
    if (existing.status === EditorialStatus.ARCHIVED) {
      throw new ConflictException('Archived fanzines cannot be published');
    }
    return this.prisma.fanzine.update({
      where: { id },
      data: {
        status: EditorialStatus.PUBLISHED,
        publishedAt: existing.publishedAt ?? new Date(),
      },
    });
  }

  async archiveFanzine(id: string) {
    await this.requireFanzine(id);
    return this.prisma.fanzine.update({
      where: { id },
      data: { status: EditorialStatus.ARCHIVED },
    });
  }

  findPublicFestival() {
    return this.prisma.festivalEntry.findMany({
      where: { status: EditorialStatus.PUBLISHED },
      orderBy: [
        { startsAt: 'asc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findPublicFestivalEntry(slug: string) {
    const item = await this.prisma.festivalEntry.findFirst({
      where: { slug, status: EditorialStatus.PUBLISHED },
    });
    if (!item) throw new NotFoundException('Festival entry not found');
    return item;
  }

  findAdminFestival() {
    return this.prisma.festivalEntry.findMany({
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
  }

  async createFestivalEntry(input: CreateFestivalEntryDto) {
    this.assertDateRange(input.startsAt, input.endsAt);
    try {
      return await this.prisma.festivalEntry.create({
        data: {
          slug: input.slug,
          title: input.title.trim(),
          summary: input.summary.trim(),
          body: input.body.trim(),
          location: input.location?.trim() || null,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Festival slug already exists');
    }
  }

  async updateFestivalEntry(
    id: string,
    input: UpdateFestivalEntryDto,
  ) {
    const existing = await this.requireFestivalEntry(id);
    if (existing.status === EditorialStatus.ARCHIVED) {
      throw new ConflictException(
        'Archived festival entries cannot be edited',
      );
    }
    this.requireEditableInput(input);
    const startsAt =
      input.startsAt === undefined
        ? existing.startsAt
        : new Date(input.startsAt);
    const endsAt =
      input.endsAt === undefined
        ? existing.endsAt
        : new Date(input.endsAt);
    this.assertDateRange(
      startsAt?.toISOString(),
      endsAt?.toISOString(),
    );

    try {
      return await this.prisma.festivalEntry.update({
        where: { id },
        data: {
          slug: input.slug,
          title: input.title?.trim(),
          summary: input.summary?.trim(),
          body: input.body?.trim(),
          location:
            input.location === undefined
              ? undefined
              : input.location.trim() || null,
          startsAt,
          endsAt,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Festival slug already exists');
    }
  }

  async publishFestivalEntry(id: string) {
    const existing = await this.requireFestivalEntry(id);
    if (existing.status === EditorialStatus.ARCHIVED) {
      throw new ConflictException(
        'Archived festival entries cannot be published',
      );
    }
    return this.prisma.festivalEntry.update({
      where: { id },
      data: {
        status: EditorialStatus.PUBLISHED,
        publishedAt: existing.publishedAt ?? new Date(),
      },
    });
  }

  async archiveFestivalEntry(id: string) {
    await this.requireFestivalEntry(id);
    return this.prisma.festivalEntry.update({
      where: { id },
      data: { status: EditorialStatus.ARCHIVED },
    });
  }

  private async requireFanzine(id: string) {
    const item = await this.prisma.fanzine.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Fanzine not found');
    return item;
  }

  private async requireFestivalEntry(id: string) {
    const item = await this.prisma.festivalEntry.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException('Festival entry not found');
    return item;
  }

  private requireEditableInput(input: object): void {
    if (Object.values(input).every((value) => value === undefined)) {
      throw new BadRequestException(
        'At least one editable field is required',
      );
    }
  }

  private assertDateRange(
    startsAt?: string | null,
    endsAt?: string | null,
  ): void {
    if (
      startsAt &&
      endsAt &&
      new Date(endsAt).getTime() < new Date(startsAt).getTime()
    ) {
      throw new BadRequestException(
        'endsAt must be after or equal to startsAt',
      );
    }
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
