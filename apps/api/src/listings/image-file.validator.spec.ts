import { BadRequestException } from '@nestjs/common';
import {
  MAX_IMAGE_SIZE_BYTES,
  UploadedImageFile,
  validateUploadedImage,
} from './image-file.validator';

describe('validateUploadedImage', () => {
  const file = (
    buffer: Buffer,
    mimetype: string,
  ): UploadedImageFile => ({
    buffer,
    mimetype,
    originalname: 'image.bin',
    size: buffer.length,
  });

  it('accepts JPEG, PNG and WEBP based on binary signatures', () => {
    expect(
      validateUploadedImage(
        file(
          Buffer.from([0xff, 0xd8, 0xff, 0x00]),
          'image/jpeg',
        ),
      ),
    ).toEqual({
      extension: 'jpg',
      mimeType: 'image/jpeg',
    });

    expect(
      validateUploadedImage(
        file(
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a,
            0x0a,
          ]),
          'image/png',
        ),
      ),
    ).toEqual({
      extension: 'png',
      mimeType: 'image/png',
    });

    expect(
      validateUploadedImage(
        file(
          Buffer.from('RIFFxxxxWEBPpayload', 'ascii'),
          'image/webp',
        ),
      ),
    ).toEqual({
      extension: 'webp',
      mimeType: 'image/webp',
    });
  });

  it('rejects an unsupported or disguised file', () => {
    expect(() =>
      validateUploadedImage(
        file(Buffer.from('hello'), 'image/jpeg'),
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      validateUploadedImage(
        file(
          Buffer.from([0xff, 0xd8, 0xff, 0x00]),
          'image/png',
        ),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects empty, inconsistent and oversized files', () => {
    expect(() =>
      validateUploadedImage(file(Buffer.alloc(0), 'image/png')),
    ).toThrow(BadRequestException);

    const inconsistent = file(
      Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      'image/jpeg',
    );
    inconsistent.size = 999;

    expect(() =>
      validateUploadedImage(inconsistent),
    ).toThrow(BadRequestException);

    const oversized = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1);
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;

    expect(() =>
      validateUploadedImage(file(oversized, 'image/jpeg')),
    ).toThrow(BadRequestException);
  });
});
