'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { listingsApi } from '../lib/api';
import {
  HOME_PAGE_SIZE,
  filterPublicListings,
  paginateListings,
  paginationNumbers,
} from '../lib/home-pagination';
import type { Listing, ListingOperationType } from '../lib/types';
import { EmptyState } from './empty-state';
import { ListingCard } from './listing-card';
import { RoadmapBadge, SectionHeading } from './design-system';

type OperationFilter = ListingOperationType | 'ALL';

const universeCards = [
  {
    icon: '🛍️',
    title: 'La boutique',
    text: 'Produits, collections et commandes arriveront dans les lots L4–L5.',
    href: '#boutique',
    available: false,
  },
  {
    icon: '♻️',
    title: 'Dons & trocs',
    text: 'Le parcours communautaire réel : annonces, modération, demandes et échanges.',
    href: '#annonces',
    available: true,
  },
  {
    icon: '📖',
    title: 'Les fanzines',
    text: 'Un futur espace de lecture et de découverte éditoriale.',
    href: '#fanzines',
    available: false,
  },
  {
    icon: '🎃',
    title: 'Actualités',
    text: 'Festival, événements et contenus seront ajoutés dans le lot L6.',
    href: '#actualites',
    available: false,
  },
] as const;

export function HomeExperience() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<OperationFilter>('ALL');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;

    void listingsApi.public()
      .then((data) => {
        if (active) {
          setListings(data);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setListings([]);
          setError(
            reason instanceof Error
              ? reason.message
              : 'Impossible de charger les annonces.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reload]);

  const approved = useMemo(
    () => listings.filter((listing) => listing.status === 'APPROVED'),
    [listings],
  );
  const filtered = useMemo(
    () => filterPublicListings(approved, search, type),
    [approved, search, type],
  );
  const result = paginateListings(filtered, page);
  const numberedPages = paginationNumbers(result.page, result.pages);
  const availableCount = approved.filter(
    (item) => item.availabilityStatus === 'AVAILABLE',
  ).length;
  const giftCount = approved.filter(
    (item) => item.operationType === 'DONATION',
  ).length;

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateType(value: OperationFilter) {
    setType(value);
    setPage(1);
  }

  return (
    <div className="pm-home home-v2">
      <section className="pm-hero home-v2__welcome" aria-labelledby="pm-home-title">
        <div className="pm-hero__copy">
          <span className="pm-eyebrow">✦ Boutique &amp; univers communautaire</span>
          <h1 id="pm-home-title">
            Des frissons à découvrir.<br />
            <em>Des passions à partager.</em>
          </h1>
          <p>
            La Petite Maison évolue en plateforme 2-en-1. Le DON/TROC reste
            pleinement opérationnel ; la boutique sera activée seulement
            lorsque ses vrais produits, stocks et commandes seront prêts.
          </p>
          <div className="pm-hero__actions home-v2__hero-actions">
            <a className="pm-button pm-button--orange" href="#boutique">
              Découvrir la future boutique →
            </a>
            <a className="pm-button pm-button--light" href="#annonces">
              Voir les échanges ↔
            </a>
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
          <div className="pm-hero-float pm-hero-float--a">🛍️ Boutique en préparation</div>
          <div className="pm-hero-float pm-hero-float--b">♻️ DON &amp; TROC disponibles</div>
        </div>
      </section>

      <section className="pm-promises" aria-label="Fonctions réellement disponibles">
        <article><span>🛡️</span><div><strong>Communauté modérée</strong><small>Validation des annonces</small></div></article>
        <article><span>🔐</span><div><strong>Connexion sécurisée</strong><small>Keycloak / OIDC</small></div></article>
        <article><span>♻️</span><div><strong>DON &amp; TROC réels</strong><small>Demandes et transactions</small></div></article>
        <article><span>🖼️</span><div><strong>Galeries protégées</strong><small>Images via MinIO</small></div></article>
      </section>

      <section className="pm-section">
        <SectionHeading
          eyebrow="La plateforme 2-en-1"
          title="Explorez les univers de la Petite Maison"
          description="Le design prépare l’ensemble de la plateforme sans présenter comme actives les fonctions encore en développement."
        />
        <div className="pm-universe-grid">
          {universeCards.map((card) => (
            <a className="pm-universe-card" href={card.href} key={card.title}>
              <span className="pm-universe-card__icon" aria-hidden="true">{card.icon}</span>
              <div>
                <div className="pm-universe-card__title">
                  <strong>{card.title}</strong>
                  {card.available ? (
                    <RoadmapBadge tone="teal">DISPONIBLE</RoadmapBadge>
                  ) : (
                    <RoadmapBadge>BIENTÔT</RoadmapBadge>
                  )}
                </div>
                <p>{card.text}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="pm-section pm-future-shop" id="boutique" aria-labelledby="pm-shop-title">
        <div className="pm-future-shop__copy">
          <RoadmapBadge>LOT L4–L5</RoadmapBadge>
          <h2 id="pm-shop-title">La boutique prend place dans la maison.</h2>
          <p>
            Le catalogue commercial, les prix, le stock, le panier et les commandes
            ne sont pas encore activés. Ce lot pose seulement leur identité visuelle.
          </p>
          <a className="pm-text-link" href="#annonces">
            En attendant, découvrir les objets de la communauté →
          </a>
        </div>
        <div className="pm-future-shop__shelves" aria-hidden="true">
          <span>FIGURINES</span>
          <span>FANZINES</span>
          <span>JEUX</span>
          <span>BD &amp; LIVRES</span>
        </div>
      </section>

      <section className="pm-section pm-community-feature">
        <div>
          <span className="pm-overline">Le coin des passionnés</span>
          <h2>Un objet chez vous.<br />Une belle histoire ailleurs.</h2>
          <p>
            Proposez un livre, un jeu, une figurine ou un autre objet en don
            ou en troc. Le parcours existant reste inchangé derrière cette nouvelle interface.
          </p>
          <div className="pm-community-feature__actions">
            <a className="pm-button pm-button--teal" href="#annonces">Voir les annonces ↔</a>
            <Link className="pm-button pm-button--outline" href="/espace#publier">
              Déposer une annonce
            </Link>
          </div>
        </div>
        <div className="pm-swap-illustration" aria-hidden="true">
          <span>📚</span><strong>⇄</strong><span>🎲</span>
        </div>
      </section>

      <section className="pm-section" id="annonces" aria-labelledby="pm-community-title">
        <SectionHeading
          eyebrow="Communauté active"
          title="Tout juste dans la communauté"
          titleId="pm-community-title"
          description="Les données ci-dessous viennent du vrai Catalog Service. Aucun article fictif n’est injecté."
          action={
            <Link className="pm-text-link" href="/espace#publier">
              Déposer un objet ↗
            </Link>
          }
        />

        <form
          className="pm-search-panel"
          id="community-search"
          role="search"
          onSubmit={(event) => event.preventDefault()}
        >
          <label htmlFor="home-v2-search">Rechercher dans les annonces</label>
          <div className="pm-search-panel__row">
            <div className="pm-search-box">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="10.7" cy="10.7" r="6.8" />
                <path d="m16 16 5 5" />
              </svg>
              <input
                id="home-v2-search"
                type="search"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Un livre, un jeu, une figurine…"
              />
            </div>
            <label className="pm-select home-v2__filter-type">
              <span>Type</span>
              <select
                value={type}
                onChange={(event) => updateType(event.target.value as OperationFilter)}
              >
                <option value="ALL">Tous</option>
                <option value="DONATION">Dons</option>
                <option value="TRADE">Trocs</option>
              </select>
            </label>
          </div>
        </form>

        <div className="pm-real-stats home-v2__facts" aria-label="État réel du catalogue">
          <span><strong>{loading || error ? '—' : approved.length}</strong> annonces publiées</span>
          <span><strong>{loading || error ? '—' : availableCount}</strong> disponibles</span>
          <span><strong>{loading || error ? '—' : giftCount}</strong> dons</span>
        </div>

        {loading ? (
          <div className="pm-listing-grid home-v2__grid" aria-label="Chargement des annonces" aria-busy="true">
            {Array.from({ length: HOME_PAGE_SIZE }, (_, index) => (
              <div className="pm-skeleton" key={index} aria-hidden="true" />
            ))}
          </div>
        ) : null}

        {!loading && error ? (
          <div className="pm-error home-v2__error" role="alert">
            <strong>Impossible de charger le catalogue communautaire.</strong>
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

        {!loading && !error && filtered.length === 0 ? (
          <EmptyState
            eyebrow={approved.length === 0 ? 'Premières annonces à venir' : 'Aucun résultat'}
            title={
              approved.length === 0
                ? 'Il n’y a pas encore d’annonces publiées.'
                : 'Aucune annonce ne correspond à votre recherche.'
            }
            text={
              approved.length === 0
                ? 'Les prochaines annonces apparaîtront ici après leur approbation.'
                : 'Essayez un autre mot ou changez le type de publication.'
            }
          />
        ) : null}

        {!loading && !error && result.items.length > 0 ? (
          <>
            <p className="pm-results home-v2__results" aria-live="polite">
              {result.start}–{result.end} sur {result.total} annonce{result.total > 1 ? 's' : ''}
            </p>
            <div className="pm-listing-grid home-v2__grid">
              {result.items.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  href={'/annonces/' + listing.id}
                  showAvailability
                />
              ))}
            </div>
          </>
        ) : null}

        {!loading && !error && result.pages > 1 && result.total > 0 ? (
          <nav className="pm-pagination home-v2__pagination" aria-label="Pagination des annonces">
            <button
              type="button"
              disabled={result.page === 1}
              onClick={() => setPage(result.page - 1)}
            >
              ← Précédent
            </button>
            {numberedPages.map((number, index) => (
              <span key={number}>
                {index > 0 && number > numberedPages[index - 1] + 1 ? (
                  <span className="pm-pagination__gap" aria-hidden="true">…</span>
                ) : null}
                <button
                  type="button"
                  aria-label={'Page ' + number}
                  aria-current={number === result.page ? 'page' : undefined}
                  className={number === result.page ? 'is-current' : ''}
                  onClick={() => setPage(number)}
                >
                  {number}
                </button>
              </span>
            ))}
            <button
              type="button"
              disabled={result.page === result.pages}
              onClick={() => setPage(result.page + 1)}
            >
              Suivant →
            </button>
          </nav>
        ) : null}
      </section>

      <section className="pm-section pm-story-grid">
        <article id="fanzines">
          <div className="pm-story-art" aria-hidden="true"><strong>FANZINES</strong><span>☾</span></div>
          <div>
            <RoadmapBadge>LOT L6</RoadmapBadge>
            <h2>Des histoires à dévorer.</h2>
            <p>Le futur espace fanzine reprendra cette identité lorsque le contenu et les droits d’accès seront réellement cadrés.</p>
          </div>
        </article>
        <article id="actualites">
          <div className="pm-story-art pm-story-art--festival" aria-hidden="true"><strong>FESTIVAL</strong><span>✦</span></div>
          <div>
            <RoadmapBadge>LOT L6</RoadmapBadge>
            <h2>Le fantastique se vit aussi ensemble.</h2>
            <p>Les actualités et événements apparaîtront ici sans inventer de dates ni de programmation.</p>
          </div>
        </article>
      </section>
    </div>
  );
}
