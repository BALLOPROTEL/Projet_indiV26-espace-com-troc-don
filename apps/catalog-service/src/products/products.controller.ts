import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AppRole } from '../auth/app-role.enum';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductSearchDto } from './dto/product-search.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister uniquement les produits commerciaux publiés',
  })
  findPublic(@Query() query: ProductSearchDto) {
    return this.products.findPublic(query);
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Consulter un produit commercial publié par son slug',
  })
  findPublicBySlug(@Param('slug') slug: string) {
    return this.products.findPublicBySlug(slug);
  }
}

@ApiTags('admin-products')
@ApiBearerAuth()
@Roles(AppRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister le catalogue commercial complet (ADMIN)',
  })
  findAdmin() {
    return this.products.findAdmin();
  }

  @Post()
  @ApiOperation({
    summary: 'Créer un produit commercial en brouillon (ADMIN)',
  })
  create(@Body() input: CreateProductDto) {
    return this.products.create(input);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier les métadonnées produit (ADMIN)',
  })
  update(
    @Param('id') id: string,
    @Body() input: UpdateProductDto,
  ) {
    return this.products.update(id, input);
  }

  @Patch(':productId/variants/:variantId')
  @ApiOperation({
    summary: 'Modifier prix, stock ou disponibilité variante (ADMIN)',
  })
  updateVariant(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() input: UpdateProductVariantDto,
  ) {
    return this.products.updateVariant(
      productId,
      variantId,
      input,
    );
  }

  @Post(':id/publish')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Publier explicitement un produit commercial (ADMIN)',
  })
  publish(@Param('id') id: string) {
    return this.products.publish(id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Archiver et retirer un produit de la vitrine (ADMIN)',
  })
  archive(@Param('id') id: string) {
    return this.products.archive(id);
  }
}
