'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ApiError,
  favoritesApi,
  listingsApi,
} from '../lib/api';
import {
  formatListingDate,
  operationLabel,
} from '../lib/presentation';
import type { Listing } from '../lib/types';
import { canRestoreProposalAnchor } from '../lib/listing-navigation';
import { ListingProposalForm } from './listing-proposal-form';
import { ListingImageGallery } from './listing-image-gallery';
import { useAuth } from './auth-provider';

export function ListingDetail({ id }: { id: string }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    ready: authReady,
    authenticated,
    login,
    getToken,
    subject,
  } = useAuth();
  const [favoriteState, setFavoriteState] = useState<{
    context: string;
    favorited: boolean;
    error: string | null;
  } | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const favoriteContext =
    authenticated && subject && listing
      ? `${subject}:${listing.id}`
      : null;
  const favoriteChecked =
    favoriteContext !== null &&
    favoriteState?.context === favoriteContext;
  const favorited = favoriteChecked
    ? favoriteState.favorited
    : false;
  const favoriteError = favoriteChecked
    ? favoriteState.error
    : null;

  useEffect(() => {
    let active = true;

    void listingsApi
      .publicById(id)
      .then((data) => {
        if (active) {
          setListing(data);
          setError(null);
          setNotFound(false);
        }
      })
      .catch((reason: unknown) => {
        if (!active) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 404) {
          setNotFound(true);
          setError(null);
          return;
        }

        setError(
          reason instanceof Error
            ? reason.message
            : 'Impossible de charger cette fiche.',
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!favoriteContext || !listing) {
      return;
    }

    let active = true;
    const context = favoriteContext;

    void getToken()
      .then((token) => favoritesApi.state(token, listing.id))
      .then((state) => {
        if (active) {
          setFavoriteState({
            context,
            favorited: state.favorited,
            error: null,
          });
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setFavoriteState({
            context,
            favorited: false,
            error:
              reason instanceof Error
                ? reason.message
                : 'Impossible de lire vos favoris.',
          });
        }
      });

    return () => {
      active = false;
    };
  }, [favoriteContext, getToken, listing]);

  async function toggleFavorite() {
    if (!listing || favoriteBusy) return;

    if (!authenticated) {
      await login();
      return;
    }

    if (!favoriteContext) {
      return;
    }

    setFavoriteBusy(true);

    try {
      const token = await getToken();
      const state = favorited
        ? await favoritesApi.remove(token, listing.id)
        : await favoritesApi.add(token, listing.id);
      setFavoriteState({
        context: favoriteContext,
        favorited: state.favorited,
        error: null,
      });
    } catch (reason) {
      setFavoriteState({
        context: favoriteContext,
        favorited,
        error:
          reason instanceof Error
            ? reason.message
            : 'Impossible de modifier ce favori.',
      });
    } finally {
      setFavoriteBusy(false);
    }
  }

  // On first navigation from Keycloak, the browser may consume the hash
  // while only PageLoading exists. Restore the requested form after the
  // asynchronously fetched listing and its proposal section are mounted.
  useEffect(() => {
    if (!canRestoreProposalAnchor(
      typeof window === 'undefined' ? '' : window.location.hash,
      !loading && !error && !notFound && listing !== null,
    )) return;
    // The global document uses smooth scrolling, while Next.js may perform
    // a competing scroll restoration during initial client hydration. An
    // explicit instant scroll with a delayed, visibility-checked retry keeps
    // the requested form in view after Keycloak redirects without animating
    // a long page unexpectedly.
    let userInteracted = false;
    let frame = 0;
    let retry = 0;
    let lateRetry = 0;
    const cancelPending = () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retry);
      window.clearTimeout(lateRetry);
    };
    // Preserve deliberate user scrolling rather than hijacking the viewport.
    const cancelOnUserInput = () => {
      userInteracted = true;
      cancelPending();
    };
    const restore = () => {
      if (userInteracted || window.location.hash !== '#faire-une-demande') return;
      const target = document.getElementById('faire-une-demande');
      if (!target) return;
      const top = target.getBoundingClientRect().top;
      if (top < 64 || top > Math.min(window.innerHeight * 0.6, 550)) {
        target.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
      }
    };
    window.addEventListener('wheel', cancelOnUserInput, { passive: true });
    window.addEventListener('touchstart', cancelOnUserInput, { passive: true });
    window.addEventListener('pointerdown', cancelOnUserInput, { passive: true });
    window.addEventListener('keydown', cancelOnUserInput);
    frame = window.requestAnimationFrame(restore);
    retry = window.setTimeout(restore, 450);
    lateRetry = window.setTimeout(restore, 1100);
    return () => {
      cancelPending();
      window.removeEventListener('wheel', cancelOnUserInput);
      window.removeEventListener('touchstart', cancelOnUserInput);
      window.removeEventListener('pointerdown', cancelOnUserInput);
      window.removeEventListener('keydown', cancelOnUserInput);
    };
  }, [loading, error, notFound, listing]);

  if (loading) {
    return (
      <div className="page-loading">
        <span className="page-loading__mark" aria-hidden="true" />
        <span>Ouverture de la fiche…</span>
      </div>
    );
  }

  if (notFound) {
    return (
      <section className="detail-missing">
        <span className="eyebrow">Fiche introuvable</span>
        <h1>Cet objet n’est pas exposé.</h1>
        <p>
          La fiche a peut-être été retirée, ou elle n’a pas encore
          été approuvée par la réserve.
        </p>
        <Link className="button" href="/">
          Retour aux annonces
        </Link>
      </section>
    );
  }

  if (error || !listing) {
    return (
      <section className="detail-missing">
        <span className="eyebrow">Incident de lecture</span>
        <h1>Impossible d’ouvrir cette fiche.</h1>
        <p>{error ?? 'Une erreur inattendue est survenue.'}</p>
        <Link className="button" href="/">
          Retour aux annonces
        </Link>
      </section>
    );
  }

  return (
    <article className="listing-detail listing-detail-v2">
      <div className="listing-detail__breadcrumbs">
        <Link href="/">Accueil</Link>
        <span aria-hidden="true">›</span>
        <Link href="/echanges">Échanges & dons</Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">{listing.title}</span>
      </div>

      <div className="listing-detail__layout">
        <section className="listing-detail__main">
          <div className="listing-detail__meta">
            <span
              className={`tag tag--${listing.operationType.toLowerCase()}`}
            >
              {operationLabel(listing.operationType)}
            </span>
            <span>{listing.operationType === 'TRADE' ? 'TROC / ÉCHANGE' : 'DON GRATUIT'} · {formatListingDate(listing.createdAt)}</span>
          </div>

          <span className="listing-detail__index" aria-hidden="true">
            FICHE · {listing.id.slice(0, 8).toUpperCase()}
          </span>

          <h1>{listing.title}</h1>

          <div className="listing-detail__top-actions">
            {listing.availabilityStatus === 'AVAILABLE' ? (
              <a className="listing-detail__quick-action" href="#faire-une-demande">
                {listing.operationType === 'DONATION' ? 'Demander cet objet' : 'Proposer un troc'}
                <span aria-hidden="true"> ↓</span>
              </a>
            ) : null}

            {authReady ? (
              <button
                className="listing-detail__favorite"
                type="button"
                disabled={authenticated && (!favoriteChecked || favoriteBusy)}
                onClick={() => void toggleFavorite()}
              >
                <span aria-hidden="true">{favorited ? '♥' : '♡'}</span>
                {!authenticated
                  ? 'Enregistrer'
                  : favoriteBusy
                    ? 'Mise à jour…'
                    : favorited
                      ? 'Retirer des favoris'
                      : 'Ajouter aux favoris'}
              </button>
            ) : null}
          </div>

          <div className="listing-detail__summary">
            <p>{listing.description}</p>
          </div>

          <dl className="listing-detail__facts">
            <div>
              <dt>Statut</dt>
              <dd>
                {listing.availabilityStatus === 'AVAILABLE'
                  ? 'Disponible'
                  : listing.availabilityStatus === 'RESERVED'
                    ? 'Réservé'
                    : 'Terminé'}
              </dd>
            </div>
            <div>
              <dt>Nature</dt>
              <dd>{operationLabel(listing.operationType)}</dd>
            </div>
            {listing.operationType === 'TRADE' &&
            listing.tradeWishes.length > 0 ? (
              <div>
                <dt>Souhait</dt>
                <dd>{listing.tradeWishes[0].label}</dd>
              </div>
            ) : (
              <div>
                <dt>Modalité</dt>
                <dd>Sans contrepartie</dd>
              </div>
            )}
            <div>
              <dt>Annonce déposée</dt>
              <dd>{formatListingDate(listing.createdAt)}</dd>
            </div>
          </dl>

          <div className="listing-detail__member-card">
            <div className="listing-detail__member-avatar" aria-hidden="true">
              PM
            </div>
            <div>
              <strong>Membre de la communauté</strong>
              <span>Annonce approuvée par la modération</span>
            </div>
          </div>

          {favoriteError ? (
            <p role="alert" className="notice notice--error listing-detail__favorite-error">
              {favoriteError}
            </p>
          ) : null}

          <ListingImageGallery
            key={listing.id}
            listingTitle={listing.title}
            images={listing.images}
          />

          {listing.operationType === 'TRADE' ? (
            <section className="listing-wishes">
              <span className="eyebrow">
                Contreparties recherchées
              </span>
              <h2>Ce qui pourrait faire l’échange.</h2>
              <div className="listing-wishes__grid">
                {listing.tradeWishes.map((wish, index) => (
                  <div className="listing-wish" key={wish.id}>
                    <span>
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                    <strong>{wish.label}</strong>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="listing-wishes">
              <span className="eyebrow">Don</span>
              <h2>Aucune contrepartie demandée.</h2>
              <p>
                Cet objet est proposé gratuitement à un autre membre
                de la communauté.
              </p>
            </section>
          )}

          <div id="faire-une-demande" className="listing-detail__proposal-target">
            <ListingProposalForm listing={listing} />
          </div>

          <div className="listing-detail__actions">
            <Link className="button" href="/publier">
              Déposer mon objet
            </Link>
            <Link className="text-link" href="/echanges">
              ← Toutes les annonces
            </Link>
          </div>
        </section>


      </div>
    </article>
  );
}
