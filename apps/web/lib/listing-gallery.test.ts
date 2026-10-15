import { describe, expect, it } from 'vitest';
import { galleryMove, sortGalleryImages } from './listing-gallery';

describe('product gallery navigation', () => {
  it('wraps between the first and last photo', () => {
    expect(galleryMove(0, -1, 5)).toBe(4);
    expect(galleryMove(4, 1, 5)).toBe(0);
    expect(galleryMove(1, 1, 5)).toBe(2);
    expect(galleryMove(1, -1, 5)).toBe(0);
  });

  it('never selects an invalid index for an empty gallery', () => {
    expect(galleryMove(0, 1, 0)).toBe(0);
    expect(galleryMove(0, -1, 0)).toBe(0);
  });

  it('orders images by persisted position without mutating the API array', () => {
    const input = [
      { id: 'b', position: 1, contentUrl: '/b', mimeType: 'image/png', sizeBytes: 200 },
      { id: 'a', position: 0, contentUrl: '/a', mimeType: 'image/png', sizeBytes: 100 },
    ];
    expect(sortGalleryImages(input).map((image) => image.id)).toEqual(['a', 'b']);
    expect(input[0].id).toBe('b');
  });
});
