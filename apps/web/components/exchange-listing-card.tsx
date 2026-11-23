/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { listingAssetUrl } from '../lib/api';
import { formatListingDate } from '../lib/presentation';
import type { Listing } from '../lib/types';

type Props = {
  listing: Listing;
};

function operationCopy(listing: Listing) {
  if (listing.operationType === 'DONATION') {
    return {
      badge: 'DON GRATUIT',
      eyebrow: 'DON GRATUIT',
      helper: 'À récupérer gratuitement',
      fallback: 'DON',
    };
  }

  const firstWish = listing.tradeWishes[0]?.label?.trim();

  return {
    badge: 'À ÉCHANGER',
    eyebrow: 'TROC / ÉCHANGE',
    helper: firstWish
      ? `Recherche : ${firstWish}`
      : 'Proposé à l’échange',
    fallback: 'ÉCHANGE',
  };
}

export function ExchangeListingCard({
  listing,
}: Props) {
  const cover =
    listing.status === 'APPROVED'
      ? listing.images[0]
      : undefined;
  const copy = operationCopy(listing);

  return (
    <article className="pm-exchange-card">
      <Link
        className="pm-exchange-card__link"
        href={`/annonces/${listing.id}`}
        aria-label={`Voir l’annonce : ${listing.title}`}
      >
        <div
          className={
            listing.operationType === 'DONATION'
              ? 'pm-exchange-card__visual pm-exchange-card__visual--donation'
              : 'pm-exchange-card__visual pm-exchange-card__visual--trade'
          }
        >
          {cover ? (
            <img
              src={listingAssetUrl(cover.contentUrl)}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              className="pm-exchange-card__fallback"
              aria-hidden="true"
            >
              <span>
                {listing.operationType === 'DONATION'
                  ? '🎁'
                  : '↔'}
              </span>
              <strong>{copy.fallback}</strong>
            </div>
          )}

          <span className="pm-exchange-card__badge">
            {copy.badge}
          </span>
        </div>

        <div className="pm-exchange-card__body">
          <span className="pm-exchange-card__eyebrow">
            {copy.eyebrow}
          </span>

          <h3>{listing.title}</h3>

          <p className="pm-exchange-card__helper">
            {copy.helper}
          </p>

          <p className="pm-exchange-card__date">
            {formatListingDate(listing.createdAt)}
          </p>

          <div className="pm-exchange-card__footer">
            <span className="pm-exchange-card__member">
              <span aria-hidden="true">●</span>
              Membre de la communauté
            </span>

            <span className="pm-exchange-card__cta">
              Voir l’annonce <span aria-hidden="true">→</span>
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
