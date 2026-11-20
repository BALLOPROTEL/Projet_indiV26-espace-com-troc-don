'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { listingsApi } from '../lib/api';
import type { Listing } from '../lib/types';
import { ListingCard } from './listing-card';
import { RoadmapBadge, SectionHeading } from './design-system';

const shopUniverses = [
  ['🧛', 'Figurines'],
  ['🎬', 'Films & Blu-ray'],
  ['📚', 'BD & Livres'],
  ['🎲', 'Jeux'],
  ['🎁', 'Goodies'],
] as const;

export function HomeExperience() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;

    void listingsApi.public()
      .then((data) => {
        if (!active) return;
        setListings(data);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setListings([]);
        setError(
          reason instanceof Error
            ? reason.message
            : 'Impossible de charger les annonces.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reload]);

  const communityPreview = useMemo(
    () => listings.filter((listing) => listing.status === 'APPROVED').slice(0, 3),
    [listings],
  );

  return (
    <div className="pm-home home-v2">
      <section className="pm-hero home-v2__welcome" aria-labelledby="pm-home-title">
        <div className="pm-hero__copy">
          <span className="pm-eyebrow">✦ Boutique &amp; univers communautaire</span>
          <h1 id="pm-home-title">
            Des frissons à acheter.<br />
            <em>Des passions à partager.</em>
          </h1>
          <p>
            Découvrez les univers de la maison, puis retrouvez chaque expérience
            sur sa propre page : boutique, échanges, fanzines et festival.
          </p>
          <div className="pm-hero__actions home-v2__hero-actions">
            <Link className="pm-button pm-button--orange" href="/boutique">
              Explorer la boutique →
            </Link>
            <Link className="pm-button pm-button--light" href="/echanges">
              Découvrir les échanges ↔
            </Link>
          </div>
        </div>

        <div className="pm-hero__graphic" aria-hidden="true">
          <div className="pm-moon" />
          <span className="pm-bat">⌁</span>
          <div className="pm-house">
            <div className="pm-house__roof" />
            <div className="pm-house__main" />
            <div className="pm-house__window pm-house__window--one" />
            <div className="pm-house__window pm-house__window--two" />
            <div className="pm-house__door" />
          </div>
          <div className="pm-hero-float pm-hero-float--a">🛍️ Boutique &amp; collections</div>
          <div className="pm-hero-float pm-hero-float--b">♻️ Échanges entre passionnés</div>
        </div>
      </section>

      <section className="pm-promises" aria-label="Promesses de la plateforme">
        <article><span>📦</span><div><strong>Univers boutique</strong><small>Catalogue commercial à venir</small></div></article>
        <article><span>🔐</span><div><strong>Parcours sécurisé</strong><small>Connexion Keycloak</small></div></article>
        <article><span>♻️</span><div><strong>Seconde vie</strong><small>Dons et trocs entre membres</small></div></article>
        <article><span>💬</span><div><strong>Une vraie communauté</strong><small>Échanges avec les passionnés</small></div></article>
      </section>

      <section className="pm-section">
        <SectionHeading
          eyebrow="Explorez nos univers"
          title="Une maison, plusieurs expériences"
          description="Chaque univers possède désormais sa propre page."
        />
        <div className="pm-home-universe-strip">
          {shopUniverses.map(([icon, label]) => (
            <Link href="/boutique" key={label}>
              <span aria-hidden="true">{icon}</span>
              <strong>{label}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="pm-section pm-home-shop-teaser" aria-labelledby="home-shop-title">
        <div className="pm-home-section-line">
          <div>
            <span className="pm-overline">Boutique</span>
            <h2 id="home-shop-title">Les coups de cœur du moment</h2>
            <p>Le catalogue réel sera affiché uniquement quand son backend sera disponible.</p>
          </div>
          <Link className="pm-text-link" href="/boutique">Tout voir →</Link>
        </div>
        <div className="pm-home-shop-grid">
          {[
            ['🧛', 'Figurines'],
            ['🎬', 'Films & Blu-ray'],
            ['📖', 'Fanzines'],
            ['🎲', 'Jeux'],
          ].map(([icon, label]) => (
            <Link href="/boutique" key={label}>
              <div aria-hidden="true">{icon}</div>
              <small>UNIVERS</small>
              <strong>{label}</strong>
              <RoadmapBadge>BIENTÔT</RoadmapBadge>
            </Link>
          ))}
        </div>
      </section>

      <section className="pm-section pm-community-feature">
        <div>
          <span className="pm-overline">Le coin des passionnés</span>
          <h2>Un objet chez vous.<br />Une belle histoire ailleurs.</h2>
          <p>
            Proposez un livre, un jeu, une figurine ou un objet en don ou en troc.
            Les annonces et transactions sont reliées aux services réels.
          </p>
          <div className="pm-community-feature__actions">
            <Link className="pm-button pm-button--teal" href="/echanges">
              Voir les annonces ↔
            </Link>
            <Link className="pm-button pm-button--outline" href="/espace#publier">
              Déposer une annonce
            </Link>
          </div>
        </div>
        <div className="pm-swap-illustration" aria-hidden="true">
          <span>📚</span><strong>⇄</strong><span>🎲</span>
        </div>
      </section>

      <section className="pm-section" aria-labelledby="pm-community-title">
        <SectionHeading
          eyebrow="Communauté"
          title="Tout juste dans la communauté"
          titleId="pm-community-title"
          description="Un aperçu des dernières annonces approuvées. Le catalogue complet est sur la page Échanges & dons."
          action={<Link className="pm-text-link" href="/echanges">Tout voir →</Link>}
        />

        {loading ? (
          <div className="pm-listing-grid home-v2__grid" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="pm-skeleton" key={index} aria-hidden="true" />
            ))}
          </div>
        ) : null}

        {!loading && error ? (
          <div className="pm-error home-v2__error" role="alert">
            <strong>Impossible de charger l’aperçu communautaire.</strong>
            <p>{error}</p>
            <button
              className="pm-button pm-button--navy"
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
                setReload((count) => count + 1);
              }}
            >
              Réessayer
            </button>
          </div>
        ) : null}

        {!loading && !error && communityPreview.length === 0 ? (
          <div className="pm-prototype-empty">
            <h2>Les premières annonces arriveront bientôt.</h2>
            <p>Les annonces approuvées par la modération apparaîtront ici.</p>
          </div>
        ) : null}

        {!loading && !error && communityPreview.length > 0 ? (
          <div className="pm-listing-grid home-v2__grid">
            {communityPreview.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                href={'/annonces/' + listing.id}
                showAvailability
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className="pm-section pm-story-grid">
        <article>
          <div className="pm-story-art" aria-hidden="true">
            <strong>ÉPOUVANTE</strong><span>☾</span>
          </div>
          <div>
            <span className="pm-overline">Le fanzine</span>
            <h2>Des histoires à dévorer.</h2>
            <p>Découvrez l’espace éditorial sur sa page dédiée.</p>
            <Link className="pm-text-link" href="/fanzines">Découvrir →</Link>
          </div>
        </article>
        <article>
          <div className="pm-story-art pm-story-art--festival" aria-hidden="true">
            <strong>FESTIVAL</strong><span>✦</span>
          </div>
          <div>
            <span className="pm-overline">Événements</span>
            <h2>Le Petit Festival</h2>
            <p>Actualités et rencontres ont désormais leur propre espace.</p>
            <Link className="pm-text-link" href="/festival">Voir l’actualité →</Link>
          </div>
        </article>
      </section>
    </div>
  );
}
