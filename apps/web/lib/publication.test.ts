import { describe, expect, it } from 'vitest';
import {
  createBlankListingInput,
  normalizedListingInput,
  validatePublicationDraft,
} from './publication';

const images = Array.from({ length: 5 }, (_, index) => ({
  name: `image-${index}.jpg`,
  type: 'image/jpeg',
  size: 128,
}));

describe('enriched publication helpers', () => {
  it('starts a trade draft with five wish slots', () => {
    const draft = createBlankListingInput();

    expect(draft.operationType).toBe('TRADE');
    expect(draft.tradeWishes).toHaveLength(5);
  });

  it('accepts a trade with five images and five distinct wishes', () => {
    const draft = {
      ...createBlankListingInput(),
      title: 'Objet à échanger',
      description: 'Description suffisamment détaillée.',
      tradeWishes: ['Console', 'Tablette', 'Écran', 'Clavier', 'Casque'],
    };

    expect(
      validatePublicationDraft(draft, images, 0),
    ).toBeNull();
  });

  it('rejects too few images and duplicate trade wishes', () => {
    const draft = {
      ...createBlankListingInput(),
      tradeWishes: ['Console', 'Tablette', 'Écran', 'Clavier', 'console'],
    };

    expect(
      validatePublicationDraft(draft, images.slice(0, 4), 0),
    ).toContain('5');

    expect(
      validatePublicationDraft(draft, images, 0),
    ).toContain('souhaits distincts');
  });

  it('treats I and i as duplicate wishes independently of browser locale', () => {
    const draft = {
      ...createBlankListingInput(),
      tradeWishes: ['I', 'i', 'Console', 'Tablette', 'Écran'],
    };

    expect(
      validatePublicationDraft(draft, images, 0),
    ).toContain('souhaits distincts');
  });

  it('accepts donation without wishes and strips them from payload', () => {
    const draft = {
      ...createBlankListingInput(),
      operationType: 'DONATION' as const,
      tradeWishes: ['Console'],
    };

    expect(
      validatePublicationDraft(draft, images, 0),
    ).toBeNull();
    expect(normalizedListingInput(draft).tradeWishes).toEqual([]);
  });

  it('rejects unsupported or oversized images', () => {
    const donation = {
      ...createBlankListingInput(),
      operationType: 'DONATION' as const,
      tradeWishes: [],
    };

    expect(
      validatePublicationDraft(
        donation,
        [
          ...images.slice(0, 4),
          {
            name: 'bad.gif',
            type: 'image/gif',
            size: 128,
          },
        ],
        0,
      ),
    ).toContain('JPEG');

    expect(
      validatePublicationDraft(
        donation,
        [
          ...images.slice(0, 4),
          {
            name: 'large.jpg',
            type: 'image/jpeg',
            size: 5 * 1024 * 1024 + 1,
          },
        ],
        0,
      ),
    ).toContain('5 MiB');
  });
});
