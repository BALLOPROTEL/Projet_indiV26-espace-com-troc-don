import type { ListingImage } from './types';

export function sortGalleryImages(images: readonly ListingImage[]): ListingImage[] {
  return [...images].sort((a, b) => a.position - b.position);
}

export function galleryMove(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return ((index + delta) % count + count) % count;
}
