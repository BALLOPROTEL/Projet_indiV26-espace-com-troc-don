import { BadRequestException } from '@nestjs/common';

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

export type ValidatedImage = {
  extension: 'jpg' | 'png' | 'webp';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
};

export function validateUploadedImage(
  file: UploadedImageFile,
): ValidatedImage {
  if (!file.buffer || file.buffer.length === 0) {
    throw new BadRequestException('Image file is empty');
  }

  if (
    file.size <= 0 ||
    file.size !== file.buffer.length ||
    file.size > MAX_IMAGE_SIZE_BYTES
  ) {
    throw new BadRequestException(
      'Each image must be at most 5 MiB',
    );
  }

  const detected = detectImageType(file.buffer);

  if (!detected) {
    throw new BadRequestException(
      'Only JPEG, PNG and WEBP images are allowed',
    );
  }

  if (file.mimetype.toLowerCase() !== detected.mimeType) {
    throw new BadRequestException(
      'Declared image MIME type does not match file content',
    );
  }

  return detected;
}

function detectImageType(
  buffer: Buffer,
): ValidatedImage | undefined {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return {
      extension: 'jpg',
      mimeType: 'image/jpeg',
    };
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return {
      extension: 'png',
      mimeType: 'image/png',
    };
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return {
      extension: 'webp',
      mimeType: 'image/webp',
    };
  }

  return undefined;
}
