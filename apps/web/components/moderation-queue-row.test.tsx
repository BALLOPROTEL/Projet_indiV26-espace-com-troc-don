import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModerationQueueRow } from './moderation-queue-row';
import type { Listing } from '../lib/types';

const fixture: Listing = {
  id: 'listing-1',
  ownerId: 'user-1',
  title: 'Étagère de seconde main',
  description: 'Étagère à donner, en bon état.',
  operationType: 'DONATION',
  status: 'PENDING',
  availabilityStatus: 'AVAILABLE',
  moderationReason: null,
  createdAt: '2026-10-18T10:00:00.000Z',
  updatedAt: '2026-10-18T10:00:00.000Z',
  images: Array.from({ length: 5 }, (_, index) => ({
    id: 'private-' + index, position: index, mimeType: 'image/jpeg',
    sizeBytes: 1000, contentUrl: '/api/private-image-' + index,
  })),
  tradeWishes: [],
};

describe('compact moderation queue', () => {
  it('summarizes a pending listing without leaking its private photo URLs', () => {
    const html = renderToStaticMarkup(
      <ModerationQueueRow listing={fixture} index={0}>
        <button type="button">Voir les 5 photos</button>
      </ModerationQueueRow>,
    );
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
    expect(html).toContain('Étagère de seconde main');
    expect(html).toContain('À examiner');
    expect(html).toContain('5 photos');
    expect(html).toContain('Informations déposées');
    expect(html).toContain('Voir les 5 photos');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('private-image-');
  });

  it('shows all trade wishes and preserves very long titles for review', () => {
    const title = 'Objet réutilisable '.repeat(24);
    const html = renderToStaticMarkup(
      <ModerationQueueRow listing={{
        ...fixture, title, operationType: 'TRADE',
        tradeWishes: [{ id: 'wish-1', label: 'Livre de cuisine', position: 0 }],
      }} index={8}>Révision</ModerationQueueRow>,
    );
    expect(html).toContain(title.trim());
    expect(html).toContain('1 souhait');
    expect(html).toContain('Livre de cuisine');
    expect(html).toContain('09');
  });
});
