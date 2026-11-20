import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ProductImage,
  ProductStatus,
} from '../../generated/prisma';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import {
  UploadedImageFile,
  validateUploadedImage,
} from '../listings/image-file.validator';

export const MAX_PRODUCT_IMAGES = 8;

export type AdminProductImageView = {
  id: string;
  position: number;
  mimeType: string;
  sizeBytes: number;
};

export type ProductImageContent = {
  body: Buffer;
  contentType: string;
  contentLength?: number;
};

@Injectable()
export class ProductImagesService {
  private readonly logger = new Logger(ProductImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  async replaceImages(
    productId: string,
    files: UploadedImageFile[],
  ): Promise<AdminProductImageView[]> {
    if (
      files.length < 1 ||
      files.length > MAX_PRODUCT_IMAGES
    ) {
      throw new BadRequestException(
        `Upload between 1 and ${MAX_PRODUCT_IMAGES} product images`,
      );
    }

    const product = await this.requireEditableProduct(productId);
    const validated = files.map((file) => ({
      file,
      detected: validateUploadedImage(file),
    }));

    await this.storage.assertReady();

    const uploaded: Array<{
      objectKey: string;
      mimeType: string;
      sizeBytes: number;
      position: number;
    }> = [];

    try {
      for (const [position, entry] of validated.entries()) {
        const objectKey =
          `products/${productId}/${randomUUID()}.${entry.detected.extension}`;

        uploaded.push({
          objectKey,
          mimeType: entry.detected.mimeType,
          sizeBytes: entry.file.buffer.length,
          position,
        });

        await this.storage.putObject(
          objectKey,
          entry.file.buffer,
          entry.detected.mimeType,
        );
      }
    } catch (error) {
      await this.bestEffortDelete(
        uploaded.map((image) => image.objectKey),
        'rollback after product image upload failure',
      );
      throw error;
    }

    let images: ProductImage[];

    try {
      const updated = await this.prisma.$transaction(
        async (transaction) => {
          const claim = await transaction.product.updateMany({
            where: {
              id: productId,
              updatedAt: product.updatedAt,
              status: {
                not: ProductStatus.ARCHIVED,
              },
            },
            data: {
              updatedAt: new Date(
                product.updatedAt.getTime() + 1,
              ),
            },
          });

          if (claim.count !== 1) {
            throw new ConflictException(
              'Product changed while images were uploading; retry',
            );
          }

          return transaction.product.update({
            where: { id: productId },
            data: {
              images: {
                deleteMany: {},
                create: uploaded,
              },
            },
            include: {
              images: {
                orderBy: {
                  position: 'asc',
                },
              },
            },
          });
        },
      );

      images = updated.images;
    } catch (error) {
      await this.bestEffortDelete(
        uploaded.map((image) => image.objectKey),
        'rollback after product image database failure',
      );
      throw error;
    }

    await this.bestEffortDelete(
      product.images.map((image) => image.objectKey),
      'cleanup of replaced product images',
    );

    return images.map((image) => ({
      id: image.id,
      position: image.position,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
    }));
  }

  async deleteDraftImages(
    productId: string,
  ): Promise<{ deleted: number }> {
    const product = await this.requireEditableProduct(productId);

    if (product.status !== ProductStatus.DRAFT) {
      throw new ConflictException(
        'Published product images can only be replaced, not removed',
      );
    }

    if (product.images.length === 0) {
      return { deleted: 0 };
    }

    await this.prisma.productImage.deleteMany({
      where: { productId },
    });

    await this.bestEffortDelete(
      product.images.map((image) => image.objectKey),
      'cleanup after product image deletion',
    );

    return { deleted: product.images.length };
  }

  async readAdminImage(
    productId: string,
    imageId: string,
  ): Promise<ProductImageContent> {
    const image = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
    });

    if (!image) {
      throw new NotFoundException('Product image not found');
    }

    return this.readImageObject(image);
  }

  async readPublicImage(
    productId: string,
    imageId: string,
  ): Promise<ProductImageContent> {
    const image = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
        product: {
          status: ProductStatus.PUBLISHED,
        },
      },
    });

    if (!image) {
      throw new NotFoundException('Product image not found');
    }

    return this.readImageObject(image);
  }

  private async requireEditableProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.status === ProductStatus.ARCHIVED) {
      throw new ConflictException(
        'Archived product images cannot be changed',
      );
    }

    return product;
  }

  private async readImageObject(
    image: ProductImage,
  ): Promise<ProductImageContent> {
    const object = await this.storage.readObject(image.objectKey);

    return {
      body: object.body,
      contentType: image.mimeType,
      contentLength:
        object.contentLength ?? image.sizeBytes,
    };
  }

  private async bestEffortDelete(
    objectKeys: string[],
    reason: string,
  ): Promise<void> {
    if (objectKeys.length === 0) {
      return;
    }

    try {
      await this.storage.deleteObjects(objectKeys);
    } catch {
      this.logger.warn(
        `Object storage cleanup failed: ${reason}`,
      );
    }
  }
}
