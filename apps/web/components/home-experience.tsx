'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listingsApi } from '../lib/api';
import type { Listing } from '../lib/types';
import { EmptyState } from './empty-state';
import { ListingCard } from './listing-card';

export function HomeExperience() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void listingsApi
      .public()
      .then((data) => {
        if (active) {
          setListings(data);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Impossible de charger le cabinet.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <section className="hero">
        <div className="hero__copy">
          <span className="eyebrow">Troc · don · seconde histoire</span>
          <h1>
            Les objets ne disparaissent pas.
            <em> Ils changent de maison.</em>
          </h1>
          <p className="hero__lead">
            Ici, les curiosités, livres, accessoires et trouvailles
            passent de main en main. Chaque annonce est relue avant de
            rejoindre le cabinet public.
          </p>
          <div className="hero__actions">
            <Link className="button" href="/espace">
              Proposer un objet
            </Link>
            <a className="text-link" href="#cabinet">
              Parcourir les trouvailles
            </a>
          </div>
        </div>

        <aside className="hero-note" aria-label="Principe du cabinet">
          <span className="hero-note__number">N° 26</span>
          <p className="hero-note__kicker">Règle de la maison</p>
          <p>
            Rien ne paraît ici sans passer par la réserve. Un objet
            approuvé rejoint ensuite le cabinet, visible de tous.
          </p>
          <span className="hero-note__stamp" aria-hidden="true">
            relu
          </span>
        </aside>
      </section>

      <section className="manifesto-strip" aria-label="Principes">
        <p>
          <strong>Donner plutôt que jeter.</strong>
          <span>Échanger plutôt qu’accumuler.</span>
          <span>Modérer avant de publier.</span>
        </p>
      </section>

      <section className="catalogue-section" id="cabinet">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Le cabinet du moment</span>
            <h2>Objets récemment admis</h2>
          </div>
          <p>
            Une sélection vivante : seules les annonces approuvées
            apparaissent ici.
          </p>
        </div>

        {loading ? (
          <div className="skeleton-grid" aria-label="Chargement des annonces">
            <span />
            <span />
            <span />
          </div>
        ) : null}

        {error ? (
          <div className="notice notice--error" role="alert">
            <strong>Le cabinet reste fermé un instant.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {!loading && !error && listings.length === 0 ? (
          <EmptyState
            eyebrow="Étagères calmes"
            title="Aucun objet exposé pour le moment."
            text="Les premières annonces approuvées apparaîtront ici. Vous pouvez déjà proposer la vôtre."
          />
        ) : null}

        {listings.length > 0 ? (
          <div className="listing-grid">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                href={`/annonces/${listing.id}`}
              />
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}
