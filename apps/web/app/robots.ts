import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/espace',
          '/espace/',
          '/moderation',
          '/moderation/',
          '/publier',
          '/publier/',
          '/mes-annonces',
          '/mes-annonces/',
          '/messages',
          '/messages/',
          '/boutique/produit',
          '/boutique/produit/',
          '/fanzines/lecteur',
          '/fanzines/lecteur/',
          '/panier',
          '/panier/',
          '/commande',
          '/commande/',
          '/mes-commandes',
          '/mes-commandes/',
          '/favoris',
          '/favoris/',
          '/notifications',
          '/notifications/',
          '/parametres',
          '/parametres/',
          '/silent-check-sso.html',
        ],
      },
    ],
    sitemap: new URL('/sitemap.xml', siteUrl).href,
  };
}
