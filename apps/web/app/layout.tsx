import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '../components/auth-provider';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import { getSiteUrl } from '../lib/site-url';
import './globals.css';
import './design-system.css';
import './prototype-operational.css';

const siteName = 'La Petite Maison de l’Épouvante';
const description =
  'Communauté de don et de troc pour passionnés d’horreur et de fantastique, en évolution vers une plateforme boutique + communauté.';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0d2338',
};

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  applicationName: siteName,
  title: {
    default: siteName,
    template: `%s · ${siteName}`,
  },
  description,
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName,
    title: siteName,
    description,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'La Petite Maison de l’Épouvante — boutique et communauté',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteName,
    description,
    images: ['/twitter-image'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>
        <AuthProvider>
          <SiteHeader />
          <main className="page-shell">{children}</main>
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
