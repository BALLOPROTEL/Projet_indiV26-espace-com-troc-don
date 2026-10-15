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
import { useAuth } from './auth-provider';
import { EmptyState } from './empty-state';
import { ListingCard } from './listing-card';

type OperationFilter = ListingOperationType | 'ALL';

export function HomeExperience() {
  const { ready, authenticated, username } = useAuth();
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
          setError(reason instanceof Error
            ? reason.message
            : 'Impossible de charger les annonces.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
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
    <div className="home-v2">
      <section className="home-v2__welcome" aria-labelledby="home-welcome-title">
        <div className="home-v2__welcome-inner">
          <div className="home-v2__welcome-copy">
            <span className="home-v2__kicker">
              <span className="home-v2__status-dot" aria-hidden="true" />
              La communauté de la seconde vie
            </span>
            <h1 id="home-welcome-title">
              {ready && authenticated && username
                ? `Bonjour ${username}`
                : 'Bienvenue à la Petite Maison'}
              <span aria-hidden="true"> 👋</span>
            </h1>
            <p>
              Donnez ce qui ne vous sert plus, trouvez votre prochain coup
              de cœur et échangez en toute confiance.
            </p>
            <Link className="home-v2__hero-action" href="/espace">
              Proposer un article <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="home-v2__facts" aria-label="La communauté en chiffres">
            {loading || error ? (
              <p className="home-v2__facts-pending">
                {loading ? 'Actualisation du catalogue…' : 'Catalogue indisponible'}
              </p>
            ) : (
              <>
                <div><strong>{approved.length}</strong><span>Annonces publiées</span></div>
                <div><strong>{availableCount}</strong><span>Articles disponibles</span></div>
                <div><strong>{giftCount}</strong><span>Dons proposés</span></div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="home-v2__catalog" id="annonces" aria-labelledby="home-catalog-title">
        <div className="home-v2__section-intro">
          <div>
            <span className="home-v2__overline">Notre sélection communautaire</span>
            <h2 id="home-catalog-title">Les articles à découvrir</h2>
            <p>De belles histoires commencent avec un objet qui change de mains.</p>
          </div>
          <Link className="home-v2__secondary-link" href="/espace">
            Mon espace <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <form className="home-v2__filters" role="search" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="home-v2-search" className="home-v2__search-label">
            Rechercher un article
          </label>
          <div className="home-v2__search-row">
            <div className="home-v2__search-box">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="10.7" cy="10.7" r="6.8" />
                <path d="m16 16 5 5" />
              </svg>
              <input
                id="home-v2-search"
                type="search"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Un livre, une lampe, un meuble…"
              />
            </div>
            <label className="home-v2__filter-type">
              <span>Type</span>
              <select
                value={type}
                onChange={(event) => updateType(event.target.value as OperationFilter)}
              >
                <option value="ALL">Tous les articles</option>
                <option value="DONATION">Dons</option>
                <option value="TRADE">Trocs</option>
              </select>
            </label>
          </div>
        </form>

        {loading ? (
          <div className="home-v2__grid" aria-label="Chargement des articles" aria-busy="true">
            {Array.from({ length: HOME_PAGE_SIZE }, (_, index) => (
              <div className="home-v2__skeleton" key={index} aria-hidden="true" />
            ))}
          </div>
        ) : null}
        {!loading && error ? (
          <div className="home-v2__error" role="alert">
            <strong>Impossible de charger le catalogue.</strong>
            <p>{error}</p>
            <button type="button" onClick={() => {
              setLoading(true);
              setError(null);
              setReload((count) => count + 1);
            }}>
              Réessayer
            </button>
          </div>
        ) : null}
        {!loading && !error && filtered.length === 0 ? (
          <EmptyState
            eyebrow={approved.length === 0 ? 'Premiers articles à venir' : 'Aucun résultat'}
            title={approved.length === 0
              ? 'Il n’y a pas encore d’annonces publiées.'
              : 'Aucun article ne correspond à votre recherche.'}
            text={approved.length === 0
              ? 'Les prochaines annonces apparaîtront ici après leur approbation.'
              : 'Essayez un autre mot ou changez le type de publication.'}
          />
        ) : null}

        {!loading && !error && result.items.length > 0 ? (
          <>
            <p className="home-v2__results" aria-live="polite">
              {result.start}–{result.end} sur {result.total} article{result.total > 1 ? 's' : ''}
              <span> · Six articles maximum par page</span>
            </p>
            <div className="home-v2__grid">
              {result.items.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  href={`/annonces/${listing.id}`}
                  showAvailability
                />
              ))}
            </div>
          </>
        ) : null}

        {!loading && !error && result.pages > 1 && result.total > 0 ? (
          <nav className="home-v2__pagination" aria-label="Pagination des annonces">
            <button type="button" disabled={result.page === 1} onClick={() => setPage(result.page - 1)}>
              ← Précédent
            </button>
            {numberedPages.map((number, index) => (
              <span className="home-v2__page-segment" key={number}>
                {index > 0 && number > numberedPages[index - 1] + 1 ? (
                  <span className="home-v2__gap" aria-hidden="true">…</span>
                ) : null}
                <button
                  type="button"
                  aria-label={`Page ${number}`}
                  aria-current={number === result.page ? 'page' : undefined}
                  className={number === result.page ? 'is-current' : ''}
                  onClick={() => setPage(number)}
                >
                  {number}
                </button>
              </span>
            ))}
            <button type="button" disabled={result.page === result.pages} onClick={() => setPage(result.page + 1)}>
              Suivant →
            </button>
            <span className="home-v2__page-counter">Page {result.page} sur {result.pages}</span>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
