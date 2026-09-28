import type { ListingInput } from './types';

export const MIN_IMAGES = 5;
export const MAX_IMAGES = 8;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MIN_WISHES = 5;
export const MAX_WISHES = 10;

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export type ImageCandidate = {
  name: string;
  type: string;
  size: number;
};

export function createBlankListingInput(): ListingInput {
  return {
    title: '',
    description: '',
    operationType: 'TRADE',
    tradeWishes: Array.from({ length: MIN_WISHES }, () => ''),
  };
}

export function padWishes(wishes: string[]): string[] {
  if (wishes.length >= MIN_WISHES) {
    return wishes.slice(0, MAX_WISHES);
  }

  return [
    ...wishes,
    ...Array.from(
      { length: MIN_WISHES - wishes.length },
      () => '',
    ),
  ];
}

export function normalizedListingInput(
  value: ListingInput,
): ListingInput {
  return {
    title: value.title.trim(),
    description: value.description.trim(),
    operationType: value.operationType,
    tradeWishes:
      value.operationType === 'TRADE'
        ? value.tradeWishes
            .map((wish) => wish.trim())
            .filter(Boolean)
        : [],
  };
}

export function validatePublicationDraft(
  value: ListingInput,
  selectedImages: ImageCandidate[],
  existingImageCount: number,
): string | null {
  const effectiveImageCount =
    selectedImages.length > 0
      ? selectedImages.length
      : existingImageCount;

  if (
    effectiveImageCount < MIN_IMAGES ||
    effectiveImageCount > MAX_IMAGES
  ) {
    return `Ajoutez entre ${MIN_IMAGES} et ${MAX_IMAGES} images avant l’envoi.`;
  }

  for (const image of selectedImages) {
    if (!IMAGE_TYPES.has(image.type)) {
      return 'Les images doivent être au format JPEG, PNG ou WEBP.';
    }

    if (image.size > MAX_IMAGE_SIZE) {
      return `L’image « ${image.name} » dépasse 5 MiB.`;
    }
  }

  if (value.operationType === 'DONATION') {
    return null;
  }

  const normalized = value.tradeWishes
    .map((wish) => wish.trim())
    .filter(Boolean);
  const distinct = new Set(
    normalized.map((wish) => wish.toLocaleLowerCase()),
  );

  if (
    distinct.size < MIN_WISHES ||
    distinct.size > MAX_WISHES
  ) {
    return `Un troc exige entre ${MIN_WISHES} et ${MAX_WISHES} souhaits distincts.`;
  }

  return null;
}
