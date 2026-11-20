'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AccountShell } from './account-shell';
import { useAuth } from './auth-provider';
import { RoadmapBadge } from './design-system';

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
  return (
    <PendingAccountShell view="favorites">
      <section className="pm-account-placeholder">
        <RoadmapBadge>BACKEND FAVORIS REQUIS</RoadmapBadge>
        <h2>Mes favoris</h2>
        <p>
          Les favoris seront persistés ici lorsqu’un contrat backend utilisateur
          sera disponible.
        </p>
        <div className="pm-empty-table" role="status">
          <span aria-hidden="true">♡</span>
          <strong>Aucun favori réel enregistré</strong>
        </div>
        <Link className="pm-button pm-button--teal" href="/boutique">Découvrir la boutique</Link>
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
