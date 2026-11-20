import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Product,
  ProductImage,
  ProductStatus,
  ProductVariant,
} from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductSearchDto } from './dto/product-search.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';

type ProductWithAssets = Product & {
  variants: ProductVariant[];
  images: ProductImage[];
};

export type AdminProductImageView = {
  id: string;
  position: number;
  mimeType: string;
  sizeBytes: number;
};

export type AdminProductView = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  currency: string;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  variants: PublicProductVariantView[];
  images: AdminProductImageView[];
};

export type PublicProductVariantView = {
  id: string;
  sku: string;
  label: string;
  priceCents: number;
  stock: number;
  active: boolean;
};

export type PublicProductImageView = {
  id: string;
  position: number;
  mimeType: string;
  sizeBytes: number;
  contentUrl: string;
};

export type PublicProductView = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  currency: string;
  fromPriceCents: number;
  availableStock: number;
  variants: PublicProductVariantView[];
  images: PublicProductImageView[];
};

const publicVariantOrder = {
  priceCents: 'asc' as const,
};

const adminInclude = {
  variants: {
    orderBy: [
      { createdAt: 'asc' as const },
      { id: 'asc' as const },
    ],
  },
  images: {
    orderBy: {
      position: 'asc' as const,
    },
  },
};

const publicInclude = {
  variants: {
    where: { active: true },
    orderBy: publicVariantOrder,
  },
  images: {
    orderBy: {
      position: 'asc' as const,
    },
  },
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(
    query: ProductSearchDto,
  ): Promise<PublicProductView[]> {
    const q = query.q?.trim();
    const category = query.category?.trim();

    const products = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.PUBLISHED,
        variants: {
          some: { active: true },
        },
        images: {
          some: {},
        },
        ...(category
          ? {
              category: {
                equals: category,
                mode: 'insensitive' as const,
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                {
                  name: {
                    contains: q,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  description: {
                    contains: q,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      include: publicInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });

    return products.map((product) => this.toPublic(product));
  }

  async findPublicBySlug(
    slug: string,
  ): Promise<PublicProductView> {
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        status: ProductStatus.PUBLISHED,
        variants: {
          some: { active: true },
        },
        images: {
          some: {},
        },
      },
      include: publicInclude,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.toPublic(product);
  }

  async getInternalVariantSnapshot(
    productId: string,
    variantId: string,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          where: { id: variantId },
          take: 1,
        },
        images: {
          orderBy: { position: 'asc' },
          take: 1,
        },
      },
    });

    if (!product || product.variants.length !== 1) {
      throw new NotFoundException('Product variant not found');
    }

    const variant = product.variants[0];

    return {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      currency: product.currency,
      status: product.status,
      variantId: variant.id,
      variantLabel: variant.label,
      priceCents: variant.priceCents,
      stock: variant.stock,
      active: variant.active,
      primaryImageId: product.images[0]?.id ?? null,
    };
  }

  async findAdmin(): Promise<AdminProductView[]> {
    const products = await this.prisma.product.findMany({
      include: adminInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });

    return products.map((product) => this.toAdmin(product));
  }

  async create(
    input: CreateProductDto,
  ): Promise<AdminProductView> {
    this.assertUniqueSkus(input.variants.map((variant) => variant.sku));

    try {
      const product = await this.prisma.product.create({
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description,
          category: input.category,
          currency: input.currency ?? 'EUR',
          status: ProductStatus.DRAFT,
          variants: {
            create: input.variants.map((variant) => ({
              sku: variant.sku,
              label: variant.label,
              priceCents: variant.priceCents,
              stock: variant.stock,
              active: variant.active ?? true,
            })),
          },
        },
        include: adminInclude,
      });

      return this.toAdmin(product);
    } catch (error) {
      this.rethrowUniqueConflict(error);
    }
  }

  async update(
    id: string,
    input: UpdateProductDto,
  ): Promise<AdminProductView> {
    if (
      input.slug === undefined &&
      input.name === undefined &&
      input.description === undefined &&
      input.category === undefined
    ) {
      throw new BadRequestException(
        'At least one editable product field is required',
      );
    }

    const existing = await this.requireAdminProduct(id);

    if (existing.status === ProductStatus.ARCHIVED) {
      throw new ConflictException(
        'Archived products cannot be edited',
      );
    }

    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description,
          category: input.category,
        },
        include: adminInclude,
      });

      return this.toAdmin(product);
    } catch (error) {
      this.rethrowUniqueConflict(error);
    }
  }

  async updateVariant(
    productId: string,
    variantId: string,
    input: UpdateProductVariantDto,
  ): Promise<AdminProductView> {
    if (
      input.label === undefined &&
      input.priceCents === undefined &&
      input.stock === undefined &&
      input.active === undefined
    ) {
      throw new BadRequestException(
        'At least one editable variant field is required',
      );
    }

    const product = await this.requireAdminProduct(productId);

    if (product.status === ProductStatus.ARCHIVED) {
      throw new ConflictException(
        'Variants of archived products cannot be edited',
      );
    }

    const variant = product.variants.find(
      (item) => item.id === variantId,
    );

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    if (
      product.status === ProductStatus.PUBLISHED &&
      input.active === false &&
      variant.active &&
      product.variants.filter((item) => item.active).length === 1
    ) {
      throw new ConflictException(
        'A published product must keep at least one active variant',
      );
    }

    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        label: input.label,
        priceCents: input.priceCents,
        stock: input.stock,
        active: input.active,
      },
    });

    return this.toAdmin(
      await this.requireAdminProduct(productId),
    );
  }

  async publish(id: string): Promise<AdminProductView> {
    const product = await this.requireAdminProduct(id);

    if (product.status === ProductStatus.ARCHIVED) {
      throw new ConflictException(
        'Archived products cannot be published',
      );
    }

    if (product.variants.every((variant) => !variant.active)) {
      throw new ConflictException(
        'A product needs at least one active variant before publication',
      );
    }

    if (product.images.length === 0) {
      throw new ConflictException(
        'A product needs at least one image before publication',
      );
    }

    await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.PUBLISHED },
    });

    return this.toAdmin(await this.requireAdminProduct(id));
  }

  async archive(id: string): Promise<AdminProductView> {
    await this.requireAdminProduct(id);

    await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED },
    });

    return this.toAdmin(await this.requireAdminProduct(id));
  }

  private async requireAdminProduct(
    id: string,
  ): Promise<ProductWithAssets> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: adminInclude,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private toAdmin(
    product: ProductWithAssets,
  ): AdminProductView {
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      category: product.category,
      currency: product.currency,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        label: variant.label,
        priceCents: variant.priceCents,
        stock: variant.stock,
        active: variant.active,
      })),
      images: product.images.map((image) => ({
        id: image.id,
        position: image.position,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
      })),
    };
  }

  private toPublic(
    product: ProductWithAssets,
  ): PublicProductView {
    if (
      product.variants.length === 0 ||
      product.images.length === 0
    ) {
      throw new Error(
        'Published product invariant violated: missing active variant or image',
      );
    }

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      category: product.category,
      currency: product.currency,
      fromPriceCents: Math.min(
        ...product.variants.map((variant) => variant.priceCents),
      ),
      availableStock: product.variants.reduce(
        (sum, variant) => sum + variant.stock,
        0,
      ),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        label: variant.label,
        priceCents: variant.priceCents,
        stock: variant.stock,
        active: variant.active,
      })),
      images: product.images.map((image) => ({
        id: image.id,
        position: image.position,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        contentUrl:
          `/api/products/${product.id}/images/${image.id}/content`,
      })),
    };
  }

  private assertUniqueSkus(skus: string[]): void {
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException(
        'Variant SKUs must be unique within a product',
      );
    }
  }

  private rethrowUniqueConflict(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Product slug or variant SKU already exists',
      );
    }

    throw error;
  }
}
