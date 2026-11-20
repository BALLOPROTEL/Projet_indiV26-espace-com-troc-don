'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type ActiveItem =
  | 'overview'
  | 'publish'
  | 'listings'
  | 'exchanges'
  | 'moderation'
  | 'admin';

function initials(value: string | null) {
  const source = value?.trim() || 'Membre';
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function NavIcon({ name }: { name: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  const paths: Record<string, ReactNode> = {
    overview: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    orders: <><path d="M5 7 12 3l7 4v10l-7 4-7-4V7Z" /><path d="m5 7 7 4 7-4M12 11v10" /></>,
    listings: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5" /></>,
    favorites: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10Z" />,
    messages: <><path d="M4 5h16v11H8l-4 4V5Z" /><path d="M8 9h8M8 12h5" /></>,
    notifications: <><path d="M6 16h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v4L6 16Z" /><path d="M10 19h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></>,
    moderation: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    admin: <><path d="M4 20h16M7 20V9h10v11M9 9V5h6v4" /><path d="M10 13h4" /></>,
    logout: <><path d="m10 17 5-5-5-5M15 12H3" /><path d="M13 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function Item({
  href,
  label,
  icon,
  active,
  disabled,
}: {
  href?: string;
  label: string;
  icon: string;
  active?: boolean;
  disabled?: boolean;
}) {
  const content = (
    <>
      <NavIcon name={icon} />
      <span>{label}</span>
      {disabled ? <small>Bientôt</small> : null}
    </>
  );

  if (!href || disabled) {
    return (
      <span
        className="pm-account-nav__item is-disabled"
        aria-disabled="true"
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      className={
        active
          ? 'pm-account-nav__item is-active'
          : 'pm-account-nav__item'
      }
      href={href}
      aria-current={active ? 'page' : undefined}
    >
      {content}
    </Link>
  );
}

export function AccountShell({
  username,
  active,
  canModerate,
  isAdmin,
  onLogout,
  children,
}: {
  username: string | null;
  active: ActiveItem;
  canModerate: boolean;
  isAdmin: boolean;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="pm-account-page">
      <div className="pm-account-heading">
        <nav aria-label="Fil d’Ariane">
          <Link href="/">Accueil</Link>
          <span aria-hidden="true">›</span>
          <strong>Mon compte</strong>
        </nav>
        <h1>Mon espace</h1>
        <p>Tous vos échanges et préférences au même endroit.</p>
      </div>

      <div className="pm-account-layout">
        <aside className="pm-account-sidebar" aria-label="Navigation du compte">
          <div className="pm-account-person">
            <span className="pm-account-avatar" aria-hidden="true">
              {initials(username)}
            </span>
            <div>
              <strong>{username?.trim() || 'Membre'}</strong>
              <small>Membre passionné · Compte sécurisé</small>
            </div>
          </div>

          <nav className="pm-account-nav">
            <Item href="/espace" label="Vue d’ensemble" icon="overview" active={active === 'overview'} />
            <Item label="Mes commandes" icon="orders" disabled />
            <Item href="/mes-annonces" label="Mes annonces" icon="listings" active={active === 'listings'} />
            <Item label="Mes favoris" icon="favorites" disabled />
            <Item href="/messages" label="Messages & échanges" icon="messages" active={active === 'exchanges'} />
            <Item label="Notifications" icon="notifications" disabled />
            <Item label="Paramètres" icon="settings" disabled />
            {canModerate ? (
              <Item href="/moderation" label="Modération" icon="moderation" active={active === 'moderation'} />
            ) : null}
            {isAdmin ? (
              <Item href="/admin" label="Administration" icon="admin" active={active === 'admin'} />
            ) : null}
          </nav>

          <button className="pm-account-logout" type="button" onClick={onLogout}>
            <NavIcon name="logout" />
            Se déconnecter
          </button>
        </aside>

        <main className="pm-account-main">{children}</main>
      </div>
    </div>
  );
}
