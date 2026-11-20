'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { listingsApi } from '../lib/api';
import { filterPublicListings } from '../lib/home-pagination';
import type { Listing, ListingOperationType } from '../lib/types';
import { EmptyState } from './empty-state';
import { ListingCard } from './listing-card';

type Filter = ListingOperationType | 'ALL';

export function ExchangeSpace() {
  const [items, setItems] = useState<Listing[]>([]);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listingsApi.public()
      .then((data) => {
        if (!active) return;
        setItems(data.filter((item) => item.status === 'APPROVED'));
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Impossible de charger les annonces.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(
    () => filterPublicListings(items, '', filter),
    [items, filter],
  );

  return (
    <div className="pm-exchange-page">
      <nav className="pm-breadcrumbs" aria-label="Fil d’Ariane">
        <Link href="/">Accueil</Link>
        <span aria-hidden="true">›</span>
        <strong>Échanges & dons</strong>
      </nav>

      <section className="pm-exchange-hero">
        <div>
          <span>♻ L’espace communautaire</span>
          <h1>Partagez plus que des objets.</h1>
          <p>Donnez une seconde vie à vos collections ou trouvez la pièce qui vous manque.</p>
          <Link className="pm-button pm-button--orange" href="/espace#publier">
            + Publier une annonce
          </Link>
        </div>
        <strong aria-hidden="true">⇄</strong>
      </section>

      <section className="pm-exchange-catalog" aria-labelledby="exchange-catalog-title">
        <div className="pm-exchange-heading">
          <div>
            <h2 id="exchange-catalog-title">Annonces de la communauté</h2>
            <p>Trouvez des échanges et des dons près de vous.</p>
          </div>
          <Link className="pm-button pm-button--teal" href="/espace#publier">
            + Déposer une annonce
          </Link>
        </div>

        <div className="pm-filter-pills" role="group" aria-label="Filtrer les annonces">
          {([
            ['ALL', 'Toutes les annonces'],
            ['TRADE', '↔ Échanges'],
            ['DONATION', '🎁 Dons'],
          ] as const).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={filter === value ? 'is-active' : ''}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="pm-listing-grid" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="pm-skeleton" key={index} aria-hidden="true" />
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="pm-error" role="alert">
            <strong>Impossible de charger les annonces.</strong>
            <p>{error}</p>
          </div>
        ) : null}

        {!loading && !error && filtered.length === 0 ? (
          <EmptyState
            eyebrow="Communauté"
            title="Aucune annonce dans ce filtre."
            text="Les prochaines annonces approuvées apparaîtront ici."
          />
        ) : null}

        {!loading && !error && filtered.length > 0 ? (
          <div className="pm-listing-grid pm-exchange-grid">
            {filtered.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                href={'/annonces/' + listing.id}
                showAvailability
              />
            ))}
          </div>
        ) : null}

        <p className="pm-exchange-note">
          ✓ Les annonces sont modérées avant publication. Aucun paiement n’est intégré à l’espace de don/troc.
        </p>
      </section>
    </div>
  );
}
