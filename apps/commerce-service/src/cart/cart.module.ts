import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [AuthModule, CatalogModule, PrismaModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
