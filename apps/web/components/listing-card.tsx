/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { listingAssetUrl } from '../lib/api';
import {
  formatListingDate,
  operationLabel,
  statusLabel,
} from '../lib/presentation';
import type { Listing } from '../lib/types';

type Props = {
  listing: Listing;
  showStatus?: boolean;
  showAvailability?: boolean;
  footer?: ReactNode;
  href?: string;
};

export function ListingCard({
  listing,
  showStatus = false,
  showAvailability = false,
  footer,
  href,
}: Props) {
  const cover =
    listing.status === 'APPROVED'
      ? listing.images[0]
      : undefined;

  const availabilityLabel = listing.availabilityStatus === 'AVAILABLE'
    ? 'Disponible'
    : listing.availabilityStatus === 'RESERVED'
      ? 'Réservé'
      : 'Terminé';

  const content = (
    <>
      {cover ? (
        <div className="listing-card__cover">
          <img
            src={listingAssetUrl(cover.contentUrl)}
            alt=""
            loading="lazy"
          />
          <span>{listing.images.length} photos</span>
        </div>
      ) : (
        <div className="listing-card__cover listing-card__cover--empty">
          <svg
            className="listing-card__empty-icon"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <rect x="5" y="9" width="38" height="30" rx="5" stroke="currentColor" strokeWidth="2" />
            <circle cx="17" cy="19" r="3.5" stroke="currentColor" strokeWidth="2" />
            <path d="M8 34l11-10 8 7 6-5 7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 41L40 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".6" />
          </svg>
          <span className="listing-card__empty-label">
            {listing.images.length > 0 ? 'Aperçu non disponible' : 'Aucune photo disponible'}
          </span>
        </div>
      )}

      <div className="listing-card__meta">
        <span
          className={`tag tag--${listing.operationType.toLowerCase()}`}
        >
          {operationLabel(listing.operationType)}
        </span>
        {showAvailability ? (
          <span className={`listing-card__availability availability--${listing.availabilityStatus.toLowerCase()}`}>
            {availabilityLabel}
          </span>
        ) : (
          <span>{formatListingDate(listing.createdAt)}</span>
        )}
      </div>

      <h3>{listing.title}</h3>
      <p className="listing-card__description">
        {listing.description}
      </p>

      <div className="listing-card__assets">
        <span>
          {listing.images.length} image
          {listing.images.length > 1 ? 's' : ''}
        </span>
        {listing.operationType === 'TRADE' ? (
          <span>
            {listing.tradeWishes.length} souhait
            {listing.tradeWishes.length > 1 ? 's' : ''}
          </span>
        ) : (
          <span>Sans contrepartie</span>
        )}
      </div>

      {listing.operationType === 'TRADE' &&
      listing.tradeWishes.length > 0 ? (
        <div className="listing-card__wishes">
          {listing.tradeWishes.slice(0, 3).map((wish) => (
            <span key={wish.id}>{wish.label}</span>
          ))}
          {listing.tradeWishes.length > 3 ? (
            <span>+{listing.tradeWishes.length - 3}</span>
          ) : null}
        </div>
      ) : null}

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

      {href ? (
        <span className="listing-card__cta" aria-hidden="true">
          Voir la fiche <span>↗</span>
        </span>
      ) : null}
    </>
  );

  return (
    <article
      className={
        href
          ? 'listing-card listing-card--interactive'
          : 'listing-card'
      }
    >
      {href ? (
        <Link
          className="listing-card__link"
          href={href}
          aria-label={`Voir la fiche : ${listing.title}${showAvailability ? ` — ${availabilityLabel}` : ''}`}
        >
          {content}
        </Link>
      ) : (
        content
      )}

      {footer ? (
        <div className="listing-card__footer">{footer}</div>
      ) : null}
    </article>
  );
}
