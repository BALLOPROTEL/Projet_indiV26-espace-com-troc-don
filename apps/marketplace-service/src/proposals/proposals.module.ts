import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';

@Module({
  imports: [AuthModule, CatalogModule, MarketplaceModule, PrismaModule],
  controllers: [ProposalsController],
  providers: [ProposalsService],
})
export class ProposalsModule {}
