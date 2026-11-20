'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { favoritesApi } from '../lib/api';
import type { Listing } from '../lib/types';
import { AccountShell } from './account-shell';
import { useAuth } from './auth-provider';
import { RoadmapBadge } from './design-system';
import { ListingCard } from './listing-card';

type PendingAccountView = 'orders' | 'favorites' | 'notifications' | 'settings';

const copy: Record<PendingAccountView, { heading: string; description: string }> = {
  orders: {
    heading: 'Mes commandes',
    description: 'Retrouvez le suivi de vos achats réels.',
  },
  favorites: {
    heading: 'Mes favoris',
    description: 'Retrouvez les produits que vous souhaitez conserver.',
  },
  notifications: {
    heading: 'Mes notifications',
    description: 'Les alertes personnelles de votre compte.',
  },
  settings: {
    heading: 'Paramètres',
    description: 'Gérez votre profil et vos préférences.',
  },
};

function PendingAccountShell({
  view,
  children,
}: {
  view: PendingAccountView;
  children: ReactNode;
}) {
  const { ready, authenticated, username, roles, hasAnyRole, login, logout } = useAuth();

  if (!ready) {
    return <div className="pm-private-state" aria-busy="true">Chargement de votre espace…</div>;
  }

  if (!authenticated) {
    return (
      <div className="pm-private-state">
        <h1>{copy[view].heading}</h1>
        <p>Connectez-vous pour accéder à cet écran.</p>
        <button className="pm-button pm-button--navy" type="button" onClick={() => void login()}>
          Se connecter
        </button>
      </div>
    );
  }

  return (
    <AccountShell
      username={username}
      active={view}
      canModerate={hasAnyRole('MODERATOR', 'ADMIN')}
      isAdmin={roles.includes('ADMIN')}
      onLogout={() => void logout()}
      heading={copy[view].heading}
      description={copy[view].description}
    >
      {children}
    </AccountShell>
  );
}

export function OrdersPlaceholderPage() {
  return (
    <PendingAccountShell view="orders">
      <section className="pm-account-placeholder">
        <RoadmapBadge>BACKEND COMMANDES REQUIS</RoadmapBadge>
        <h2>Mes commandes</h2>
        <p>
          Aucune commande fictive n’est affichée. Les achats apparaîtront ici
          lorsque le vrai parcours e-commerce sera disponible.
        </p>
        <div className="pm-empty-table" role="status">
          <span aria-hidden="true">📦</span>
          <strong>Aucune commande réelle</strong>
        </div>
        <Link className="pm-button pm-button--outline" href="/boutique">Voir la boutique</Link>
      </section>
    </PendingAccountShell>
  );
}

export function FavoritesPlaceholderPage() {
  const { ready, authenticated, getToken, subject } = useAuth();
  const [items, setItems] = useState<Listing[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading =
    ready &&
    authenticated &&
    Boolean(subject) &&
    loadedFor !== subject;

  useEffect(() => {
    if (!ready || !authenticated || !subject) {
      return;
    }

    let active = true;
    const currentSubject = subject;

    void getToken()
      .then(favoritesApi.mine)
      .then((favorites) => {
        if (active) {
          setItems(favorites);
          setError(null);
          setLoadedFor(currentSubject);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setItems([]);
          setError(
            reason instanceof Error
              ? reason.message
              : 'Impossible de charger vos favoris.',
          );
          setLoadedFor(currentSubject);
        }
      });

    return () => {
      active = false;
    };
  }, [ready, authenticated, getToken, subject]);

  async function removeFavorite(listingId: string) {
    if (busyId) return;

    setBusyId(listingId);
    setError(null);

    try {
      const token = await getToken();
      await favoritesApi.remove(token, listingId);
      setItems((current) =>
        current.filter((listing) => listing.id !== listingId),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Impossible de retirer ce favori.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PendingAccountShell view="favorites">
      <section className="pm-account-placeholder">
        <RoadmapBadge>FAVORIS CONNECTÉS</RoadmapBadge>
        <h2>Mes favoris</h2>
        <p>
          Retrouvez ici les annonces approuvées que vous avez réellement
          enregistrées. La liste est liée à votre compte Keycloak.
        </p>

        {error ? (
          <p role="alert" className="notice notice--error">{error}</p>
        ) : null}

        {loading ? (
          <div className="pm-empty-table" role="status" aria-busy="true">
            <span aria-hidden="true">♡</span>
            <strong>Chargement de vos favoris…</strong>
          </div>
        ) : items.length > 0 ? (
          <div className="pm-listing-grid" aria-label="Annonces favorites">
            {items.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                href={`/annonces/${listing.id}`}
                showAvailability
                footer={(
                  <button
                    className="pm-button pm-button--outline"
                    type="button"
                    disabled={busyId === listing.id}
                    onClick={() => void removeFavorite(listing.id)}
                  >
                    {busyId === listing.id
                      ? 'Retrait…'
                      : 'Retirer des favoris'}
                  </button>
                )}
              />
            ))}
          </div>
        ) : (
          <div className="pm-empty-table" role="status">
            <span aria-hidden="true">♡</span>
            <strong>Aucun favori enregistré</strong>
          </div>
        )}

        <Link className="pm-button pm-button--teal" href="/echanges">
          Découvrir les échanges & dons
        </Link>
      </section>
    </PendingAccountShell>
  );
}

export function NotificationsPlaceholderPage() {
  return (
    <PendingAccountShell view="notifications">
      <section className="pm-account-placeholder">
        <RoadmapBadge>INBOX UTILISATEUR À EXPOSER</RoadmapBadge>
        <h2>Mes notifications</h2>
        <p>
          Le service Notifications actuel stocke des événements techniques
          globaux. Ils ne sont volontairement pas exposés dans cet écran tant
          qu’une inbox filtrée et sécurisée par utilisateur n’existe pas.
        </p>
        <div className="pm-empty-table" role="status">
          <span aria-hidden="true">🔔</span>
          <strong>Aucune notification utilisateur exposée</strong>
        </div>
      </section>
    </PendingAccountShell>
  );
}

export function SettingsPlaceholderPage() {
  const { username } = useAuth();

  return (
    <PendingAccountShell view="settings">
      <section className="pm-account-placeholder">
        <RoadmapBadge>PERSISTANCE PROFIL À CONNECTER</RoadmapBadge>
        <h2>Profil & préférences</h2>
        <p>
          La maquette 20 est prête, mais aucune préférence locale ne sera
          présentée comme enregistrée tant qu’un contrat backend n’existe pas.
        </p>

        <div className="pm-settings-form" aria-label="Préférences non persistées">
          <label>
            <span>Compte connecté</span>
            <input value={username ?? ''} readOnly />
          </label>
          <label>
            <span>Adresse e-mail</span>
            <input value="" placeholder="Donnée gérée par Keycloak" readOnly />
          </label>
          <label>
            <span>Ville</span>
            <input value="" placeholder="Non renseignée" readOnly />
          </label>

          <h3>Notifications</h3>
          <label className="pm-settings-toggle">
            <input type="checkbox" disabled />
            <span>Recevoir les actualités et nouveautés</span>
          </label>
          <label className="pm-settings-toggle">
            <input type="checkbox" disabled />
            <span>Recevoir les alertes de dons et échanges</span>
          </label>

          <button className="pm-button pm-button--navy" type="button" disabled>
            Enregistrement non activé
          </button>
        </div>
      </section>
    </PendingAccountShell>
  );
}
