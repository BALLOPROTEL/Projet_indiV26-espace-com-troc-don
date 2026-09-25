import {
  formatListingDate,
  operationLabel,
  statusLabel,
} from '../lib/presentation';
import type { Listing } from '../lib/types';

type Props = {
  listing: Listing;
  showStatus?: boolean;
  footer?: React.ReactNode;
};

export function ListingCard({
  listing,
  showStatus = false,
  footer,
}: Props) {
  return (
    <article className="listing-card">
      <div className="listing-card__meta">
        <span
          className={`tag tag--${listing.operationType.toLowerCase()}`}
        >
          {operationLabel(listing.operationType)}
        </span>
        <span>{formatListingDate(listing.createdAt)}</span>
      </div>

      <h3>{listing.title}</h3>
      <p className="listing-card__description">
        {listing.description}
      </p>

      {showStatus ? (
        <div className="listing-card__status">
          <span
            className={`status status--${listing.status.toLowerCase()}`}
          >
            {statusLabel(listing.status)}
          </span>
          {listing.status === 'REJECTED' &&
          listing.moderationReason ? (
            <p className="moderation-note">
              <strong>Note de la modération :</strong>{' '}
              {listing.moderationReason}
            </p>
          ) : null}
        </div>
      ) : null}

      {footer ? (
        <div className="listing-card__footer">{footer}</div>
      ) : null}
    </article>
  );
}
