'use client';

import {
  useEffect,
  useState,
} from 'react';
import { listingsApi } from '../lib/api';
import type { Listing } from '../lib/types';
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
  } = useAuth();

  const canModerate = hasAnyRole('MODERATOR', 'ADMIN');
  const [queue, setQueue] = useState<Listing[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
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
      await listingsApi.approve(token, listing.id);
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
      await listingsApi.reject(token, listing.id, reason);
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
    <section className="moderation-page">
      <div className="moderation-hero">
        <div>
          <span className="eyebrow">La réserve</span>
          <h1>Relire avant d’exposer.</h1>
        </div>
        <div className="queue-count">
          <strong>{queue.length.toString().padStart(2, '0')}</strong>
          <span>fiche{queue.length > 1 ? 's' : ''} en attente</span>
        </div>
      </div>

      <p className="moderation-intro">
        Ici, on ne juge pas le goût. On vérifie simplement que la
        fiche est claire, exploitable et prête à rejoindre le cabinet.
      </p>

      {error ? (
        <div className="notice notice--error" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="page-loading is-compact">
          <span className="page-loading__mark" aria-hidden="true" />
          <span>Lecture des fiches…</span>
        </div>
      ) : null}

      {!loading && queue.length === 0 ? (
        <EmptyState
          eyebrow="Réserve à jour"
          title="Aucune fiche ne vous attend."
          text="Les nouvelles propositions arriveront ici dans leur ordre de dépôt."
        />
      ) : null}

      <div className="moderation-list">
        {queue.map((listing, index) => (
          <div className="moderation-item" key={listing.id}>
            <span className="moderation-item__number">
              {(index + 1).toString().padStart(2, '0')}
            </span>
            <ListingCard listing={listing} />
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
    </section>
  );
}
