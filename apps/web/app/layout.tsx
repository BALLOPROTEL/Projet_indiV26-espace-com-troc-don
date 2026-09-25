import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '../components/auth-provider';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'La Petite Maison de l’Épouvante',
    template: '%s · La Petite Maison de l’Épouvante',
  },
  description:
    'Cabinet communautaire de troc, don et objets à faire circuler.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="fr">
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
