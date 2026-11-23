import type { Metadata } from 'next';
import { HomeExperience } from '../components/home-experience';

const description =
  'Découvrez les annonces DON/TROC de la communauté et la future plateforme 2-en-1 de La Petite Maison de l’Épouvante.';

export const metadata: Metadata = {
  title: {
    absolute: 'La Petite Maison de l’Épouvante',
  },
  description,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    url: '/',
    title: 'La Petite Maison de l’Épouvante',
    description,
  },
};

export default function HomePage() {
  return <HomeExperience />;
}
