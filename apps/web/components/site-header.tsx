'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from './auth-provider';
import { BrandMark } from './design-system';

type IconName =
  | 'heart'
  | 'message'
  | 'bell'
  | 'account'
  | 'chevron'
  | 'shield'
  | 'sign-out';

function HeaderIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    heart: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10Z" />,
    message: <><path d="M4 5h16v11H8l-4 4V5Z" /><path d="M8 9h8M8 12h5" /></>,
    bell: <><path d="M6 16h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v4L6 16Z" /><path d="M10 19h4" /></>,
    account: <><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    'sign-out': <><path d="m10 17 5-5-5-5m5 5H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

const desktopLinks = [
  { href: '/', label: 'Accueil' },
  { href: '/boutique', label: 'Boutique' },
  { href: '/echanges', label: 'Échanges & dons' },
  { href: '/fanzines', label: 'Fanzines' },
  { href: '/festival', label: 'Festival' },
] as const;

const mobileLinks = [
  { href: '/', label: 'Accueil', icon: '⌂' },
  { href: '/boutique', label: 'Boutique', icon: '▣' },
  { href: '/echanges', label: 'Échanges', icon: '⇄' },
  { href: '/publier', label: 'Publier', icon: '+' },
  { href: '/espace', label: 'Compte', icon: '◉' },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const accountMenuRef = useRef<HTMLDetailsElement>(null);
  const { ready, authenticated, username, roles, login, logout } = useAuth();
  const elevatedRole = roles.includes('ADMIN')
    ? 'Administrateur'
    : roles.includes('MODERATOR')
      ? 'Modérateur'
      : null;

  const closeAccountMenu = () => {
    if (accountMenuRef.current) accountMenuRef.current.open = false;
  };

  useEffect(() => {
    closeAccountMenu();
  }, [pathname]);

  return (
    <>
      <div className="pm-topbar">
        <span aria-hidden="true">✦</span>
        La maison de tous les passionnés : collectionner, donner et échanger
        <span aria-hidden="true">✦</span>
      </div>

      <header className="pm-header">
        <div className="pm-wrap pm-header__inner">
          <Link className="pm-brand" href="/" aria-label="La Petite Maison de l’Épouvante, accueil">
            <BrandMark />
            <span className="pm-brand__copy">
              <strong>La Petite Maison<br />de l’Épouvante</strong>
              <small>BOUTIQUE &amp; COMMUNAUTÉ</small>
            </span>
          </Link>

          <nav className="pm-main-nav" aria-label="Navigation principale">
            {desktopLinks.map((link) => {
              const active =
                (link.href === '/' && pathname === '/') ||
                (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  className={active ? 'pm-navlink is-active' : 'pm-navlink'}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="pm-header__actions">
            <Link
              className="pm-icon-button pm-icon-button--future"
              href="/boutique"
              aria-label="Favoris — en préparation"
              title="Favoris — en préparation"
            >
              <HeaderIcon name="heart" />
            </Link>
            <Link
              className="pm-icon-button"
              href="/messages"
              aria-label="Mes échanges"
              title="Mes échanges"
            >
              <HeaderIcon name="message" />
            </Link>
            <Link
              className="pm-icon-button pm-icon-button--future"
              href="/espace"
              aria-label="Notifications — en préparation"
              title="Notifications — en préparation"
            >
              <HeaderIcon name="bell" />
            </Link>

            {ready && authenticated ? (
              <details className="pm-account-menu" ref={accountMenuRef}>
                <summary aria-label="Ouvrir les accès du compte">
                  <HeaderIcon name="account" />
                  <span>Mon espace</span>
                  <HeaderIcon name="chevron" />
                </summary>
                <div className="pm-account-menu__panel">
                  <div className="pm-account-menu__identity">
                    <strong>{username?.trim() || 'Mon compte'}</strong>
                    {elevatedRole ? (
                      <span><HeaderIcon name="shield" /> {elevatedRole}</span>
                    ) : (
                      <span>Membre</span>
                    )}
                  </div>
                  <Link href="/espace" onClick={closeAccountMenu}>Tableau de bord</Link>
                  <Link href="/publier" onClick={closeAccountMenu}>Déposer un objet</Link>
                  <Link href="/mes-annonces" onClick={closeAccountMenu}>Mes annonces</Link>
                  <Link href="/messages" onClick={closeAccountMenu}>Mes échanges</Link>
                  {elevatedRole ? (
                    <Link href="/moderation" onClick={closeAccountMenu}>Modération</Link>
                  ) : null}
                  {roles.includes('ADMIN') ? (
                    <Link href="/admin" onClick={closeAccountMenu}>Administration</Link>
                  ) : null}
                  <button
                    type="button"
                    data-account-action="logout"
                    onClick={() => void logout()}
                  >
                    <HeaderIcon name="sign-out" />
                    Se déconnecter
                  </button>
                </div>
              </details>
            ) : (
              <button
                className="pm-button pm-button--navy pm-header__login"
                type="button"
                disabled={!ready}
                onClick={() => void login()}
              >
                {ready ? 'Se connecter' : 'Connexion…'}
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className="pm-mobilebar" aria-label="Navigation mobile">
        {mobileLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <span aria-hidden="true">{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
