import Link from 'next/link';
import { BrandMark } from './design-system';

export function SiteFooter() {
  return (
    <footer className="pm-footer">
      <div className="pm-wrap pm-footer__columns">
        <div className="pm-footer__about">
          <div className="pm-footer__brand">
            <BrandMark compact />
            <h2>La Petite Maison<br />de l’Épouvante</h2>
          </div>
          <p>
            La plateforme des passionnés d’horreur et de fantastique.<br />
            Une boutique, une communauté, mille histoires à partager.
          </p>
        </div>

        <div>
          <h3>Explorer</h3>
          <Link href="/boutique">La boutique</Link>
          <Link href="/echanges">Dons &amp; échanges</Link>
          <Link href="/fanzines">Les fanzines</Link>
        </div>

        <div>
          <h3>Communauté</h3>
          <Link href="/espace#publier">Publier une annonce</Link>
          <Link href="/festival">Festival</Link>
          <Link href="/notre-histoire">Notre histoire</Link>
        </div>

        <div>
          <h3>Besoin d&apos;aide ?</h3>
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Nous contacter</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/conditions">Conditions d’utilisation</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
        </div>
      </div>

      <div className="pm-wrap pm-footer__bottom">
        <span>© La Petite Maison de l’Épouvante — Projet pédagogique CESI</span>
        <span>Confidentialité · droits utilisateur · aucune donnée carte stockée</span>
      </div>
    </footer>
  );
}
