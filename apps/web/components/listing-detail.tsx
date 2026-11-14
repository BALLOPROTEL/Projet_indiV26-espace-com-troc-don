'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ApiError,
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

export function ListingDetail({ id }: { id: string }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const restore = () => {
      if (window.location.hash !== '#faire-une-demande') return;
      const target = document.getElementById('faire-une-demande');
      if (!target) return;
      const top = target.getBoundingClientRect().top;
      if (top < 64 || top > Math.min(window.innerHeight * 0.6, 550)) {
        target.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
      }
    };
    const frame = window.requestAnimationFrame(restore);
    const retry = window.setTimeout(restore, 450);
    const lateRetry = window.setTimeout(restore, 1100);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retry);
      window.clearTimeout(lateRetry);
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
        <Link href="/#annonces">Toutes les annonces</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Détail de l’article</span>
      </div>

      <div className="listing-detail__layout">
        <section className="listing-detail__main">
          <div className="listing-detail__meta">
            <span
              className={`tag tag--${listing.operationType.toLowerCase()}`}
            >
              {operationLabel(listing.operationType)}
            </span>
            <span>Admis le {formatListingDate(listing.createdAt)}</span>
          </div>

          <span className="listing-detail__index" aria-hidden="true">
            FICHE · {listing.id.slice(0, 8).toUpperCase()}
          </span>

          <h1>{listing.title}</h1>
          {listing.availabilityStatus === 'AVAILABLE' ? (
            <a className="listing-detail__quick-action" href="#faire-une-demande">
              {listing.operationType === 'DONATION' ? 'Demander cet objet' : 'Proposer un troc'}
              <span aria-hidden="true"> ↓</span>
            </a>
          ) : null}

          <ListingImageGallery
            key={listing.id}
            listingTitle={listing.title}
            images={listing.images}
          />

          <div className="listing-detail__description">
            <span className="eyebrow">À propos de l’objet</span>
            <p>{listing.description}</p>
          </div>

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
            <Link className="button" href="/espace#publier">
              Déposer mon objet
            </Link>
            <Link className="text-link" href="/#annonces">
              ← Retour aux annonces
            </Link>
          </div>
        </section>

        <aside className="listing-detail__note">
          <span className="listing-detail__seal" aria-hidden="true">
            PM
          </span>
          <span className="eyebrow">Annonce publiée</span>
          <h2>Informations sur l&apos;annonce</h2>
          <p>Cette annonce est publiée après modération. Les informations ci-dessous proviennent de sa fiche réelle.</p>
          <div className="listing-detail__rule">
            <span>Statut</span>
            <strong>{listing.availabilityStatus === 'AVAILABLE' ? 'Disponible' : listing.availabilityStatus === 'RESERVED' ? 'Réservé' : 'Terminé'}</strong>
          </div>
          <div className="listing-detail__rule">
            <span>Nature</span>
            <strong>{operationLabel(listing.operationType)}</strong>
          </div>
          <div className="listing-detail__rule">
            <span>Référence</span>
            <strong>{listing.id.slice(0, 8)}</strong>
          </div>
          <div className="listing-detail__rule">
            <span>Galerie</span>
            <strong>{listing.images.length} images</strong>
          </div>
          {listing.operationType === 'TRADE' ? (
            <div className="listing-detail__rule">
              <span>Souhaits</span>
              <strong>{listing.tradeWishes.length}</strong>
            </div>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
