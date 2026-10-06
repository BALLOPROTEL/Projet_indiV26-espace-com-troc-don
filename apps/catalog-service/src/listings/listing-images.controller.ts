import {
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Req,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  FilesInterceptor,
} from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AppRole } from '../auth/app-role.enum';
import { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { MAX_LISTING_IMAGES } from '../marketplace/marketplace-rules.service';
import {
  MAX_IMAGE_SIZE_BYTES,
  UploadedImageFile,
} from './image-file.validator';
import { ListingImagesService } from './listing-images.service';

type HeaderResponse = {
  setHeader: (name: string, value: string | number) => void;
};

@ApiTags('listing-images')
@Controller('listings')
export class ListingImagesController {
  constructor(
    private readonly listingImages: ListingImagesService,
  ) {}

  @Put(':id/images')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Remplacer les images de sa propre annonce par un lot de 5 à 8 images',
  })
  @Roles(AppRole.USER, AppRole.MODERATOR, AppRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(
    FilesInterceptor('images', MAX_LISTING_IMAGES, {
      limits: {
        files: MAX_LISTING_IMAGES,
        fileSize: MAX_IMAGE_SIZE_BYTES,
      },
    }),
  )
  replaceOwnedImages(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @UploadedFiles() files: UploadedImageFile[] = [],
  ) {
    return this.listingImages.replaceOwnedImages(
      id,
      this.requireSubject(request),
      files,
    );
  }

  @Delete(':id/images')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Supprimer les images de sa propre annonce non approuvée",
  })
  @Roles(AppRole.USER, AppRole.MODERATOR, AppRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  deleteOwnedImages(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.listingImages.deleteOwnedImages(
      id,
      this.requireSubject(request),
    );
  }

  @Get(':id/images')
  @ApiOperation({
    summary:
      "Lister les images d'une annonce approuvée",
  })
  findPublicImages(@Param('id') id: string) {
    return this.listingImages.findPublicImages(id);
  }

  @Get(':id/images/:imageId/content/authorized')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Télécharger une image privée de son annonce ou d'une annonce à modérer",
  })
  @Roles(AppRole.USER, AppRole.MODERATOR, AppRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async readAuthorizedImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    const roles = request.user?.roles ?? [];
    const image = await this.listingImages.readAuthorizedImage(
      id,
      imageId,
      this.requireSubject(request),
      roles.includes(AppRole.MODERATOR) ||
        roles.includes(AppRole.ADMIN),
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

  @Get(':id/images/:imageId/content')
  @ApiOperation({
    summary:
      "Télécharger une image d'une annonce approuvée",
  })
  async readPublicImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    const image = await this.listingImages.readPublicImage(
      id,
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

  private requireSubject(
    request: AuthenticatedRequest,
  ): string {
    if (!request.user?.sub) {
      throw new Error(
        'Authenticated subject missing after JwtAuthGuard',
      );
    }

    return request.user.sub;
  }
}
