import type { Metadata } from 'next';
import { HomeExperience } from '../components/home-experience';
import './home-v2.css';

const description =
  'Découvrez les objets proposés en don ou en troc par la communauté et faites circuler ce qui peut encore servir.';

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
