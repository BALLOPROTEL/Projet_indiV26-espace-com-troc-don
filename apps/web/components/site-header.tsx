'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './auth-provider';

const links = [
  { href: '/', label: 'Le cabinet' },
  { href: '/espace', label: 'Mon étagère' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const {
    ready,
    authenticated,
    username,
    hasAnyRole,
    login,
    logout,
  } = useAuth();

  const canModerate = hasAnyRole('MODERATOR', 'ADMIN');

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label="Accueil">
          <span className="brand__mark" aria-hidden="true">
            PM
          </span>
          <span className="brand__copy">
            <strong>La Petite Maison</strong>
            <small>de l’Épouvante</small>
          </span>
        </Link>

        <nav className="primary-nav" aria-label="Navigation principale">
          {links.map((link) => (
            <Link
              className={
                pathname === link.href
                  ? 'primary-nav__link is-active'
                  : 'primary-nav__link'
              }
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
          {canModerate ? (
            <Link
              className={
                pathname === '/moderation'
                  ? 'primary-nav__link is-active'
                  : 'primary-nav__link'
              }
              href="/moderation"
            >
              La réserve
            </Link>
          ) : null}
        </nav>

        <div className="session">
          {ready && authenticated ? (
            <>
              <span className="session__name" title={username ?? undefined}>
                {username ?? 'Membre'}
              </span>
              <button
                className="text-button"
                type="button"
                onClick={() => void logout()}
              >
                Sortir
              </button>
            </>
          ) : (
            <button
              className="button button--small"
              type="button"
              disabled={!ready}
              onClick={() => void login()}
            >
              {ready ? 'Entrer' : '…'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
