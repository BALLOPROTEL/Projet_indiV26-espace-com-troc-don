import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page introuvable',
  description: 'La page demandée n’existe pas ou n’est plus disponible.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function NotFound() {
  return (
    <section className="detail-missing" aria-labelledby="not-found-title">
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
