import type { ReactNode } from 'react';
import type { Listing } from '../lib/types';

export function ModerationQueueRow({ listing, index, children }: {
  listing: Listing;
  index: number;
  children: ReactNode;
}) {
  return (
    <details className="moderation-item management-v2__item moderation-review">
      <summary className="moderation-review__summary">
        <span className="moderation-review__number" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="moderation-review__identity">
          <strong>{listing.title}</strong>
          <span>
            Déposée le {new Date(listing.createdAt).toLocaleDateString('fr-FR')}
          </span>
        </span>
        <span className="moderation-review__badges">
          <span className="moderation-review__kind">
            {listing.operationType === 'TRADE' ? 'Troc' : 'Don'}
          </span>
          <span className="moderation-review__pending">À examiner</span>
        </span>
        <span className="moderation-review__media">
          {listing.images.length} photo{listing.images.length === 1 ? '' : 's'}
          {listing.operationType === 'TRADE' ? ` · ${listing.tradeWishes.length} souhait${listing.tradeWishes.length === 1 ? '' : 's'}` : ''}
        </span>
        <span className="moderation-review__toggle">
          <span className="moderation-review__toggle-label">Examiner</span>
          <span className="moderation-review__chevron" aria-hidden="true">⌄</span>
        </span>
      </summary>
      <div className="moderation-review__details">
        <div className="moderation-review__description">
          <h3>Informations déposées</h3>
          <p>{listing.description}</p>
          {listing.operationType === 'TRADE' && listing.tradeWishes.length > 0 ? (
            <div>
              <h4>Souhaits de troc</h4>
              <ul>{listing.tradeWishes.map(wish => <li key={wish.id}>{wish.label}</li>)}</ul>
            </div>
          ) : null}
        </div>
        {children}
      </div>
    </details>
  );
}
