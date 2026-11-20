import {
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AppRole } from '../auth/app-role.enum';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  MAX_IMAGE_SIZE_BYTES,
  UploadedImageFile,
} from '../listings/image-file.validator';
import {
  MAX_PRODUCT_IMAGES,
  ProductImagesService,
} from './product-images.service';

type HeaderResponse = {
  setHeader: (name: string, value: string | number) => void;
};

@ApiTags('product-images')
@Controller('products')
export class ProductImagesController {
  constructor(
    private readonly productImages: ProductImagesService,
  ) {}

  @Get(':productId/images/:imageId/content')
  @ApiOperation({
    summary: "Lire l'image d'un produit publié",
  })
  async readPublicImage(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    const image = await this.productImages.readPublicImage(
      productId,
      imageId,
    );

    response.setHeader(
      'Cache-Control',
      'public, max-age=300, immutable',
    );

    return new StreamableFile(image.body, {
      type: image.contentType,
      length: image.contentLength ?? image.body.length,
    });
  }
}

@ApiTags('admin-product-images')
@ApiBearerAuth()
@Roles(AppRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/products')
export class AdminProductImagesController {
  constructor(
    private readonly productImages: ProductImagesService,
  ) {}

  @Put(':id/images')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: "Remplacer les images d'un produit (ADMIN)",
  })
  @UseInterceptors(
    FilesInterceptor('images', MAX_PRODUCT_IMAGES, {
      limits: {
        files: MAX_PRODUCT_IMAGES,
        fileSize: MAX_IMAGE_SIZE_BYTES,
      },
    }),
  )
  replaceImages(
    @Param('id') id: string,
    @UploadedFiles() files: UploadedImageFile[] = [],
  ) {
    return this.productImages.replaceImages(id, files);
  }

  @Delete(':id/images')
  @ApiOperation({
    summary: "Supprimer les images d'un produit DRAFT (ADMIN)",
  })
  deleteImages(@Param('id') id: string) {
    return this.productImages.deleteDraftImages(id);
  }

  @Get(':productId/images/:imageId/content')
  @ApiOperation({
    summary: "Lire une image produit privée avant publication (ADMIN)",
  })
  async readAdminImage(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    const image = await this.productImages.readAdminImage(
      productId,
      imageId,
    );

    response.setHeader(
      'Cache-Control',
      'private, no-store',
    );

    return new StreamableFile(image.body, {
      type: image.contentType,
      length: image.contentLength ?? image.body.length,
    });
  }
}
