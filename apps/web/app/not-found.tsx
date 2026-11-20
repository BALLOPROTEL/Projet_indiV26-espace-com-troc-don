import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page introuvable',
  description: 'La page demandée n’existe pas ou n’est plus disponible.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function NotFound() {
  return (
    <section
      aria-labelledby="not-found-title"
      style={{ maxWidth: 760, margin: '72px auto', padding: '32px 24px' }}
    >
      <span className="eyebrow">Erreur 404</span>
      <h1 id="not-found-title">Cette page s’est égarée.</h1>
      <p>
        Le lien est peut-être ancien, incomplet ou la ressource a été retirée.
      </p>
      <Link className="button" href="/">
        Revenir à l’accueil
      </Link>
    </section>
  );
}
