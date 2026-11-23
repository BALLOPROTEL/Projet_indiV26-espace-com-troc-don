import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContactStatus,
  ContactSubject,
} from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateContactDto,
  CreatePrivacyRequestDto,
} from './dto/contact.dto';

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async createPublic(input: CreateContactDto) {
    const email = input.email.trim().toLowerCase();
    const since = new Date(Date.now() - 10 * 60_000);
    const recent = await this.prisma.contactMessage.count({
      where: {
        email,
        userId: null,
        createdAt: { gte: since },
      },
    });

    if (recent >= 5) {
      throw new HttpException(
        'Trop de demandes envoyées. Réessayez plus tard.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.prisma.contactMessage.create({
      data: {
        name: input.name.trim(),
        email,
        subject: input.subject,
        message: input.message.trim(),
      },
      select: {
        id: true,
        subject: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async createPrivacyRequest(
    userId: string,
    preferredUsername: string | undefined,
    input: CreatePrivacyRequestDto,
  ) {
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const recent = await this.prisma.contactMessage.count({
      where: {
        userId,
        subject: ContactSubject.PRIVACY,
        createdAt: { gte: since },
      },
    });

    if (recent >= 5) {
      throw new HttpException(
        'Trop de demandes liées aux droits envoyées aujourd’hui.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.prisma.contactMessage.create({
      data: {
        userId,
        name: preferredUsername?.trim() || null,
        subject: ContactSubject.PRIVACY,
        privacyAction: input.action,
        message: input.message.trim(),
      },
      select: {
        id: true,
        subject: true,
        privacyAction: true,
        status: true,
        createdAt: true,
      },
    });
  }

  listAdmin(status?: ContactStatus) {
    return this.prisma.contactMessage.findMany({
      where: status ? { status } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 500,
    });
  }

  async updateStatus(id: string, status: ContactStatus) {
    const exists = await this.prisma.contactMessage.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Contact message not found');
    }

    return this.prisma.contactMessage.update({
      where: { id },
      data: { status },
    });
  }
}
