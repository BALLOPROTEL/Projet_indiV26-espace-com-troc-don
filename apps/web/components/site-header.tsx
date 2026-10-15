'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { headerLinks } from '../lib/header-navigation';
import { useAuth } from './auth-provider';

type IconName = 'home' | 'box' | 'shield' | 'menu' | 'chevron' | 'sign-out';

function HeaderIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10H3z" /><path d="M9 20v-7h6v7" /></>,
    box: <><path d="m3 7 9-4 9 4v10l-9 4-9-4z" /><path d="m3 7 9 4 9-4M12 11v10" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    chevron: <><path d="m6 9 6 6 6-6" /></>,
    'sign-out': <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
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

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDetailsElement>(null);
  const closeAccountMenu = () => {
    if (accountMenuRef.current) accountMenuRef.current.open = false;
  };
  useEffect(() => {
    closeAccountMenu();
  }, [pathname]);
  const { ready, authenticated, username, roles, login, logout } = useAuth();
  const links = headerLinks(authenticated, roles);
  const elevatedRole = roles.includes('ADMIN')
    ? 'Administrateur'
    : roles.includes('MODERATOR')
      ? 'Modérateur'
      : null;
  const label = username?.trim() || 'Mon compte';
  const initial = (Array.from(label)[0] ?? 'M').toLocaleUpperCase('fr');

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label="Petite Maison, accueil">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 21.5 24 6l19 15.5V42H5V21.5Z" />
              <path d="M18 42V25h12v17M13 19.5 24 11l11 8.5" />
            </svg>
          </span>
          <span className="brand__copy">
            <strong><span>Petite</span> Maison</strong>
            <small>de l&apos;Épouvante</small>
          </span>
        </Link>

        <button
          className="site-header__menu-toggle"
          type="button"
          aria-controls="primary-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <HeaderIcon name="menu" />
          <span>Menu</span>
        </button>

        <nav
          className={menuOpen ? 'primary-nav is-open' : 'primary-nav'}
          id="primary-navigation"
          aria-label="Navigation principale"
        >
          {links.map((link) => {
            const active = pathname === link.href ||
              (link.href !== '/' && pathname.startsWith(link.href + '/'));
            return (
              <Link
                key={link.href}
                className={active ? 'primary-nav__link is-active' : 'primary-nav__link'}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <HeaderIcon name={link.icon} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="session">
          {ready && authenticated ? (
            <>
              {elevatedRole ? (
                <span className="session__role">
                  <HeaderIcon name="shield" />
                  {elevatedRole}
                </span>
              ) : null}
              <details className="session__menu" ref={accountMenuRef}>
                <summary aria-label={'Compte de ' + label}>
                  <span className="session__avatar" aria-hidden="true">{initial}</span>
                  <span className="session__identity">
                    <small>Mon espace</small>
                    <strong className="session__name" title={label}>{label}</strong>
                  </span>
                  <HeaderIcon name="chevron" />
                </summary>
                <div className="session__dropdown">
                  <p>Connecté avec Keycloak</p>
                  <Link href="/espace" onClick={closeAccountMenu}>Mes articles et échanges</Link>
                  {elevatedRole ? <Link href="/moderation" onClick={closeAccountMenu}>Espace de modération</Link> : null}
                  <button type="button" onClick={() => void logout()}>
                    <HeaderIcon name="sign-out" />
                    Sortir
                  </button>
                </div>
              </details>
            </>
          ) : (
            <button
              className="button button--small site-header__login"
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
  );
}
