/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useRef, useState } from 'react';
import { listingsApi } from '../lib/api';
import type { Listing } from '../lib/types';
import { filterPendingListings, moderationMetrics, type ModerationFilter } from '../lib/moderation-dashboard';
import { useAuth } from './auth-provider';
import { EmptyState } from './empty-state';
import { ListingCard } from './listing-card';

export function ModerationSpace() {
  const {
    ready,
    authenticated,
    hasAnyRole,
    login,
    getToken,
    username,
  } = useAuth();

  const canModerate = hasAnyRole('MODERATOR', 'ADMIN');
  const [queue, setQueue] = useState<Listing[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<ModerationFilter>('ALL');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated || !canModerate) {
      return;
    }

    let active = true;

    void getToken()
      .then((token) => listingsApi.moderation(token))
      .then((data) => {
        if (active) {
          setQueue(data);
          setLoadError(null);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setLoadError(
            reason instanceof Error
              ? reason.message
              : 'Impossible de charger la réserve.',
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
  }, [ready, authenticated, canModerate, getToken]);

  async function approve(listing: Listing) {
    setBusyId(listing.id);
    setError(null);

    try {
      const token = await getToken();
      await listingsApi.approve(
        token,
        listing.id,
        listing.updatedAt,
      );
      setQueue((current) =>
        current.filter((item) => item.id !== listing.id),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Impossible d’approuver cette annonce.',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function reject(listing: Listing) {
    const reason = (reasons[listing.id] ?? '').trim();

    if (reason.length < 3) {
      setError('Le motif de refus doit contenir au moins 3 caractères.');
      return;
    }

    setBusyId(listing.id);
    setError(null);

    try {
      const token = await getToken();
      await listingsApi.reject(
        token,
        listing.id,
        reason,
        listing.updatedAt,
      );
      setQueue((current) =>
        current.filter((item) => item.id !== listing.id),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Impossible de refuser cette annonce.',
      );
    } finally {
      setBusyId(null);
    }
  }

  const metrics = moderationMetrics(queue);
  const visibleQueue = filterPendingListings(queue, filter, query);
  const role = hasAnyRole('ADMIN') ? 'Administrateur' : 'Modérateur';

  if (!ready) {
    return (
      <div className="page-loading">
        <span className="page-loading__mark" aria-hidden="true" />
        <span>Ouverture de la réserve…</span>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <section className="gate-card">
        <span className="eyebrow">Accès réservé</span>
        <h1>La réserve est derrière cette porte.</h1>
        <p>
          Connectez-vous avec un compte modérateur ou administrateur
          pour relire les propositions.
        </p>
        <button
          className="button"
          type="button"
          onClick={() => void login()}
        >
          Se connecter
        </button>
      </section>
    );
  }

  if (!canModerate) {
    return (
      <section className="gate-card gate-card--denied">
        <span className="eyebrow">Accès limité</span>
        <h1>Cette pièce n’est pas ouverte à votre rôle.</h1>
        <p>
          Votre compte peut utiliser l’espace membre, mais la
          modération nécessite le rôle MODERATOR ou ADMIN.
        </p>
      </section>
    );
  }

  return (
    <section className="moderation-page management-v2" aria-labelledby="moderation-title">
      <div className="management-v2__layout">
        <div className="management-v2__content">
          <div className="moderation-hero management-v2__hero">
            <div>
              <span className="management-v2__eyebrow">Tableau de bord · {role}</span>
              <h1 id="moderation-title">Gérer les annonces</h1>
              <p>Bonjour{username ? ' ' + username : ''}, examinez les fiches avant publication.</p>
            </div>
            <span className="management-v2__role">{role}</span>
          </div>
          <div className="management-v2__stats" aria-label="Indicateurs réels de la file d’attente">
            <div><span>À examiner</span><strong>{loading || loadError ? '—' : metrics.total}</strong><small>Annonces en attente</small></div>
            <div><span>Dons</span><strong>{loading || loadError ? '—' : metrics.donations}</strong><small>Dons en attente</small></div>
            <div><span>Trocs</span><strong>{loading || loadError ? '—' : metrics.trades}</strong><small>Trocs en attente</small></div>
          </div>
          <div className="management-v2__section-head">
            <div><span>Validation des annonces</span><h2>File de modération</h2></div>
            <strong>{loading ? 'Chargement…' : loadError ? 'File indisponible' : metrics.total + ' à traiter'}</strong>
          </div>
          <form className="management-v2__filters" role="search" onSubmit={(event) => event.preventDefault()}>
            <label>Rechercher une fiche
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
                placeholder="Titre, description ou souhait" />
            </label>
            <label>Type de proposition
              <select value={filter} onChange={(event) => setFilter(event.target.value as ModerationFilter)}>
                <option value="ALL">Toutes</option>
                <option value="DONATION">Dons</option>
                <option value="TRADE">Trocs</option>
              </select>
            </label>
          </form>
          <p className="management-v2__result-count" role="status" aria-live="polite" aria-atomic="true">
            {loading ? 'Chargement des annonces…' : loadError ? 'Résultats indisponibles.' :
              `${visibleQueue.length} annonce${visibleQueue.length === 1 ? '' : 's'} correspond${visibleQueue.length === 1 ? '' : 'ent'} aux filtres sur ${metrics.total} en attente.`}
          </p>
          <p className="moderation-intro">
            Vérifiez les informations et chargez les photos privées à la demande.
            Leur consultation est recommandée, mais n’est pas une condition imposée par l’API.
          </p>

      {loadError || error ? (
        <div className="notice notice--error" role="alert">
          {loadError ?? error}
        </div>
      ) : null}

      {loading ? (
        <div className="page-loading is-compact">
          <span className="page-loading__mark" aria-hidden="true" />
          <span>Lecture des fiches…</span>
        </div>
      ) : null}

      {!loading && !loadError && queue.length === 0 ? (
        <EmptyState
          eyebrow="Réserve à jour"
          title="Aucune fiche ne vous attend."
          text="Les nouvelles propositions arriveront ici dans leur ordre de dépôt."
        />
      ) : null}

      {!loading && !loadError && queue.length > 0 && visibleQueue.length === 0 ? (
        <EmptyState eyebrow="Recherche" title="Aucune fiche ne correspond aux filtres."
          text="Essayez un autre titre ou sélectionnez « Toutes »." />
      ) : null}
      <div className="moderation-list management-v2__queue">
        {!loading && !loadError && visibleQueue.map((listing, index) => (
          <div className="moderation-item management-v2__item" key={listing.id}>
            <span className="moderation-item__number">
              {(index + 1).toString().padStart(2, '0')}
            </span>
            <ListingCard listing={listing} />
            <ModerationGallery
              listing={listing}
              getToken={getToken}
            />
            <div className="moderation-actions">
              <label className="field field--compact">
                <span>Motif si refus</span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={reasons[listing.id] ?? ''}
                  placeholder="Ex. préciser l’état de l’objet…"
                  onChange={(event) =>
                    setReasons((current) => ({
                      ...current,
                      [listing.id]: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="moderation-buttons">
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={busyId === listing.id}
                  onClick={() => void reject(listing)}
                >
                  Refuser avec motif
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={busyId === listing.id}
                  onClick={() => void approve(listing)}
                >
                  Approuver la fiche
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
        </div>
      </div>
    </section>
  );
}

function ModerationGallery({
  listing,
  getToken,
}: {
  listing: Listing;
  getToken: () => Promise<string>;
}) {
  const [urls, setUrls] = useState<string[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [failed, setFailed] = useState(false);
  const mountedRef = useRef(true);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      for (const url of urlsRef.current) {
        URL.revokeObjectURL(url);
      }
      urlsRef.current = [];
    };
  }, []);

  async function loadGallery() {
    if (
      listing.images.length === 0 ||
      loadingGallery ||
      urls.length > 0
    ) {
      return;
    }

    setLoadingGallery(true);
    setFailed(false);

    try {
      const token = await getToken();
      const blobs = await Promise.all(
        listing.images.map((image) =>
          listingsApi.authorizedImage(
            token,
            listing.id,
            image.id,
          ),
        ),
      );
      const nextUrls = blobs.map((blob) =>
        URL.createObjectURL(blob),
      );

      if (!mountedRef.current) {
        for (const url of nextUrls) {
          URL.revokeObjectURL(url);
        }
        return;
      }

      urlsRef.current = nextUrls;
      setUrls(nextUrls);
    } catch {
      if (mountedRef.current) {
        setFailed(true);
      }
    } finally {
      if (mountedRef.current) {
        setLoadingGallery(false);
      }
    }
  }

  if (listing.images.length === 0) {
    return (
      <div className="notice notice--error">
        Galerie absente : cette fiche ne peut pas être approuvée.
      </div>
    );
  }

  if (urls.length === 0) {
    return (
      <div className="moderation-gallery-gate">
        <button
          className="button button--quiet button--small"
          type="button"
          disabled={loadingGallery}
          onClick={() => void loadGallery()}
        >
          {loadingGallery
            ? 'Chargement des photos…'
            : `Voir les ${listing.images.length} photos`}
        </button>
        {failed ? (
          <span className="quiet-note">
            Impossible de charger la galerie privée. Réessayez.
          </span>
        ) : (
          <span className="quiet-note">
            Les photos privées sont chargées uniquement à la demande.
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="moderation-gallery"
      aria-label={`Galerie privée : ${listing.title}`}
    >
      {urls.map((url, index) => (
        <figure key={url}>
          <img
            src={url}
            alt={`${listing.title} — photo ${index + 1}`}
          />
          <figcaption>
            {(index + 1).toString().padStart(2, '0')}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
